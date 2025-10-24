import React, { useState, useEffect, useCallback } from 'react';
import { IPage as Page, IFile, enumContentBlockType, enumPageStatus } from '@itmat-broker/itmat-types';
import { PageEditor } from './PagesTab/PageEditor';
import { trpc } from '../../utils/trpc';
import css from './pageeditor.module.css';
import axios from 'axios';
import { message } from 'antd';

interface ContentBlock {
    id: string
    type: enumContentBlockType
    data: Record<string, unknown>
}

interface PageData {
    title: string
    slug: string
    status: enumPageStatus
    content: ContentBlock[]
}

interface Tab {
    id: string
    label: string
    component: React.ReactNode
}

export const PageEditorLayout: React.FC = () => {
    const [activeTab, setActiveTab] = useState('pages');

    const tabs: Tab[] = [
        {
            id: 'pages',
            label: 'Pages',
            component: <PagesManager />
        },
        {
            id: 'media',
            label: 'Media',
            component: <MediaManager />
        }
    ];



    return (
        <div className={css.page_editor_container}>
            <header className={css.page_editor_header}>
                <h1 className={css.page_editor_title}>ITMAT Page Editor</h1>
            </header>

            <nav className={css.page_editor_tabs_container}>
                <ul className={css.page_editor_tabs_list}>
                    {tabs.map(tab => (
                        <li
                            key={tab.id}
                            className={`${css.page_editor_tab} ${activeTab === tab.id ? css.page_editor_tab_active : css.page_editor_tab_inactive}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </li>
                    ))}
                </ul>
            </nav>

            <main className={css.page_editor_content}>
                {tabs.find(tab => tab.id === activeTab)?.component}
            </main>
        </div>
    );
};

// Pages Manager Component
const PagesManager: React.FC = () => {
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [editingPage, setEditingPage] = useState<Page | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);

    const getPages = trpc.page.getPages.useQuery({ limit: 100, adminView: true, searchTerm: searchTerm.trim() || undefined });
    const createPageMutation = trpc.page.createPage.useMutation();
    const updatePageMutation = trpc.page.updatePage.useMutation();
    const deletePageMutation = trpc.page.deletePage.useMutation();

    const fetchPages = useCallback(async () => {
        setLoading(true);
        try {
            if (getPages.data) {
                setPages(getPages.data.docs as unknown as Page[]);
            }
        } catch {
            void message.error('Failed to fetch pages');
        } finally {
            setLoading(false);
        }
    }, [getPages.data]);

    const handleSavePage = async (pageData: PageData) => {
        try {
            if (editingPage) {
                await updatePageMutation.mutateAsync({ id: editingPage.id, ...pageData });
                void message.success('Page updated successfully!');
            } else {
                await createPageMutation.mutateAsync(pageData);
                void message.success('Page created successfully!');
            }
            setShowEditor(false);
            setEditingPage(null);
            void getPages.refetch();
        } catch {
            void message.error('Failed to save page');
        }
    };

    const handleEditPage = (page: Page) => {
        setEditingPage(page);
        setShowEditor(true);
    };

    const handleCreatePage = () => {
        setEditingPage(null);
        setShowEditor(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this page?')) {
            try {
                await deletePageMutation.mutateAsync({ id });
                void message.success('Page deleted successfully!');
                void getPages.refetch();
            } catch {
                void message.error('Failed to delete page');
            }
        }
    };

    useEffect(() => {
        void fetchPages();
    }, [getPages.data, fetchPages]);

    if (showEditor) {
        return (
            <PageEditor
                editingPage={editingPage}
                onSave={(data) => void handleSavePage(data)}
                onCancel={() => {
                    setShowEditor(false);
                    setEditingPage(null);
                }}
            />
        );
    }


    const totalDocs = pages.length;
    const totalPages = Math.max(1, Math.ceil(totalDocs / pageSize));
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const visibleRows = pages.slice(start, end);

    return (
        <div>

            <div className={css.page_card}>
                <div className={css.page_card_header}>
                    <h2 className={css.page_card_title}>Pages</h2>
                </div>
                <div className={css.page_card_content}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                        <input
                            value={searchTerm}
                            onChange={(e) => { setCurrentPage(1); setSearchTerm(e.target.value); }}
                            placeholder="Search by title"
                            style={{ padding: '8px 12px', border: '1px solid #e1e5e9', borderRadius: 4, width: 280 }}
                        />
                        <div style={{ color: '#666', fontSize: 12 }}>Showing {visibleRows.length} of {totalDocs}</div>
                    </div>
                    <button
                        className={css.page_editor_button}
                        onClick={handleCreatePage}
                    >
                        Create New Page
                    </button>

                    {loading ? (
                        <p style={{ textAlign: 'center', color: '#666', margin: '40px 0' }}>Loading pages...</p>
                    ) : (
                        <div style={{ marginTop: '24px' }}>
                            <table className={css.page_editor_table}>
                                <thead>
                                    <tr>
                                        <th className={css.page_editor_th}>Title</th>
                                        <th className={css.page_editor_th}>Slug</th>
                                        <th className={css.page_editor_th}>Status</th>
                                        <th className={css.page_editor_th}>Created</th>
                                        <th className={css.page_editor_th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleRows.map((page) => (
                                        <tr key={page.id}>
                                            <td className={css.page_editor_td}>{page.title}</td>
                                            <td className={css.page_editor_td}><code>{page.slug}</code></td>
                                            <td className={css.page_editor_td}>
                                                <span className={`${css.page_editor_status} ${page.status === 'published' ? css.page_editor_status_published : css.page_editor_status_draft}`}>
                                                    {page.status}
                                                </span>
                                            </td>
                                            <td className={css.page_editor_td}>{new Date(page.createdAt).toLocaleDateString()}</td>
                                            <td className={css.page_editor_td}>
                                                <button
                                                    className={`${css.page_editor_button} ${css.page_editor_button_secondary}`}
                                                    onClick={() => handleEditPage(page)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className={`${css.page_editor_button} ${css.page_editor_button_danger}`}
                                                    onClick={() => void handleDelete(page.id)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Prev</button>
                                <span style={{ alignSelf: 'center' }}>{currentPage} / {totalPages}</span>
                                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Media Manager Component
const MediaManager: React.FC = () => {
    const [uploading, setUploading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });

    const getMedia = trpc.page.getMedia.useQuery({
        limit: pagination.pageSize,
        page: pagination.current,
        adminView: true
    }, {
        keepPreviousData: true,
        enabled: true
    });

    // Update pagination when data changes
    useEffect(() => {
        if (getMedia.data) {
            setPagination(prev => ({
                ...prev,
                total: getMedia.data.totalDocs || 0
            }));
        }
    }, [getMedia.data]);
    const deleteMediaMutation = trpc.page.deleteMedia.useMutation();

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {

            const formData = new FormData();
            formData.append('file', file);
            formData.append('alt', file.name); // Use filename as alt text

            const response = await axios.post('/trpc/page.createMedia', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response?.data?.result?.data?.id) {
                void message.success('File uploaded successfully!');
                void getMedia.refetch();
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorMessage = error.response?.data?.error?.message || error.message;
                void message.error(`Failed to upload file: ${errorMessage}`);
            } else {
                void message.error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this media file?')) {
            try {
                await deleteMediaMutation.mutateAsync({ id });
                void message.success('Media deleted successfully!');
                void getMedia.refetch();
            } catch {
                void message.error('Failed to delete media');
            }
        }
    };



    const formatFileSize = (bytes?: unknown) => {
        const n = typeof bytes === 'number' ? bytes : Number(bytes);
        if (!Number.isFinite(n)) return '-';
        if (n === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.min(sizes.length - 1, Math.floor(Math.log(n) / Math.log(k)));
        return `${(n / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const isImage = (f: IFile) => ['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF'].includes((f.fileType || 'UNKNOWN') as string);

    return (
        <div>

            <div className={css.page_card}>
                <div className={css.page_card_header}>
                    <h2 className={css.page_card_title}>Media Library</h2>
                </div>
                <div className={css.page_card_content}>
                    <div className={css.media_upload_area}>
                        <input
                            type="file"
                            onChange={(e) => void handleFileUpload(e)}
                            disabled={uploading}
                            style={{ display: 'none' }}
                            id="file-upload"
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xlsx,.xls"
                        />
                        <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                            {uploading ? (
                                <p>Uploading...</p>
                            ) : (
                                <div>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 500 }}>
                                        Drop files here or click to upload
                                    </p>
                                    <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                                        Supports images, videos, audio, and documents (PDF, Word, Excel)
                                    </p>
                                </div>
                            )}
                        </label>
                    </div>

                    {getMedia.isLoading ? (
                        <p style={{ textAlign: 'center', color: '#666', margin: '40px 0' }}>Loading media...</p>
                    ) : (
                        <div className={css.media_grid}>
                            {(getMedia.data?.docs as unknown as IFile[] ?? []).map((item) => (
                                <div key={item.id} className={css.media_item}>
                                    {isImage(item) ? (
                                        <img
                                            src={`/file/${item.id}`}
                                            alt={item.fileName || ''}
                                            className={css.media_preview}
                                        />
                                    ) : (
                                        <div className={css.media_preview} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '24px',
                                            color: '#666'
                                        }}>
                                            <span role="img" aria-label="document">📄</span>
                                        </div>
                                    )}
                                    <div className={css.media_info}>
                                        <div className={css.media_name}>{item.fileName || '(unnamed)'}</div>
                                        <div className={css.media_size}>{formatFileSize(item.fileSize)}</div>
                                        <button
                                            className={css.media_delete_button}
                                            onClick={() => void handleDelete(item.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {getMedia.data && getMedia.data.totalDocs > pagination.pageSize && (
                        <div className={css.pagination_container}>
                            <div className={css.pagination_controls}>
                                <button
                                    className={css.pagination_button}
                                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                                    disabled={pagination.current === 1}
                                >
                                    Previous
                                </button>
                                <span className={css.pagination_info}>
                                    Page {pagination.current} of {Math.ceil(pagination.total / pagination.pageSize)}
                                </span>
                                <button
                                    className={css.pagination_button}
                                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                                    disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};