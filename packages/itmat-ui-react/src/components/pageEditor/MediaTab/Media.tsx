import React, { useState, useEffect } from 'react';
import { IFile } from '@itmat-broker/itmat-types';
import { trpc } from '../../../utils/trpc';
import { formatBytes } from '../../../utils/tools';
import axios from 'axios';
import css from '../pageeditor.module.css';
import { message } from 'antd';

interface MediaManagerProps {
    onSelect?: (file: IFile) => void
}

export const MediaManager: React.FC<MediaManagerProps> = ({ onSelect }) => {
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



    const deleteMediaMutation = trpc.page.deleteMedia.useMutation();

    // Update pagination when data changes
    useEffect(() => {
        if (getMedia.data) {
            setPagination(prev => ({
                ...prev,
                total: getMedia.data.totalDocs || 0
            }));
        }
    }, [getMedia.data]);


    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {

            const formData = new FormData();
            formData.append('file', file);
            formData.append('alt', file.name);


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
            // Check if the error is an AxiosError and handle it accordingly
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
            } catch (error) {
                void message.error(`Failed to delete media: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };


    const styles = {
        card: {
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #e1e5e9',
            overflow: 'hidden'
        },
        cardHeader: {
            padding: '16px 20px',
            borderBottom: '1px solid #e1e5e9',
            backgroundColor: '#fafafa'
        },
        cardTitle: {
            margin: 0,
            fontSize: '16px',
            fontWeight: 600
        },
        cardContent: {
            padding: '20px'
        },
        uploadArea: {
            border: '2px dashed #e1e5e9',
            borderRadius: '6px',
            padding: '40px',
            textAlign: 'center' as const,
            marginBottom: '24px',
            cursor: 'pointer',
            transition: 'all 0.2s'
        },
        uploadAreaHover: {
            borderColor: '#000',
            backgroundColor: '#fafafa'
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px'
        },
        mediaItem: {
            border: '1px solid #e1e5e9',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: 'white'
        },
        mediaPreview: {
            width: '100%',
            height: '120px',
            objectFit: 'cover' as const,
            backgroundColor: '#f5f5f5'
        },
        mediaInfo: {
            padding: '12px'
        },
        mediaName: {
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '4px',
            wordBreak: 'break-word' as const
        },
        mediaSize: {
            fontSize: '12px',
            color: '#666',
            marginBottom: '8px'
        },
        button: {
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500
        },
        message: {
            padding: '12px 16px',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '14px'
        },
        messageSuccess: {
            backgroundColor: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb'
        },
        messageError: {
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb'
        }
    };

    const safeFormatSize = (value: unknown) => {
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(num)) return '-';
        return formatBytes(num);
    };

    const isImageFile = (file: IFile) => {
        const imageTypes = ['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF'];
        return imageTypes.includes((file.fileType || 'UNKNOWN') as string);
    };

    const isVideoFile = (file: IFile) => {
        const videoTypes = ['MP4', 'AVI'];
        return videoTypes.includes((file.fileType || 'UNKNOWN') as string);
    };

    const isPdf = (file: IFile) => (file.fileType === 'PDF');

    return (
        <div className={css.media_tab_container}>

            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <h2 style={styles.cardTitle}>Media Library</h2>
                </div>
                <div style={styles.cardContent}>
                    <div style={styles.uploadArea}>
                        <input
                            type="file"
                            onChange={(e) => void handleFileUpload(e)}
                            disabled={uploading}
                            style={{ display: 'none' }}
                            id="file-upload"
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
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
                                        Supports images, videos, audio, and documents
                                    </p>
                                </div>
                            )}
                        </label>
                    </div>

                    {getMedia.isLoading ? (
                        <p style={{ textAlign: 'center', color: '#666', margin: '40px 0' }}>Loading media...</p>
                    ) : (
                        <div className={css.media_list_container} style={styles.grid}>
                            {(getMedia.data?.docs as unknown as IFile[] ?? []).map((item) => {
                                const fileUrl = `/file/${item.id}`;
                                return (
                                    <div key={item.id} style={styles.mediaItem}>
                                        {isImageFile(item) ? (
                                            <img
                                                src={fileUrl}
                                                alt={item.fileName || ''}
                                                style={styles.mediaPreview}
                                            />
                                        ) : isVideoFile(item) ? (
                                            <video src={fileUrl} style={styles.mediaPreview as React.CSSProperties} />
                                        ) : isPdf(item) ? (
                                            <div style={{
                                                ...styles.mediaPreview,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '20px', color: '#666'
                                            }}>PDF</div>
                                        ) : (
                                            <div style={{
                                                ...styles.mediaPreview,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '20px', color: '#666'
                                            }}>FILE</div>
                                        )}
                                        <div style={styles.mediaInfo}>
                                            <div style={styles.mediaName}>
                                                {(item && typeof item.fileName === 'string' && item.fileName.trim()) ? item.fileName : '(unnamed)'}
                                            </div>
                                            <div style={styles.mediaSize}>{safeFormatSize((item as IFile)?.fileSize)}</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {onSelect ? (
                                                    <button
                                                        style={{ ...styles.button, backgroundColor: '#4b5563' }}
                                                        onClick={() => onSelect(item)}
                                                    >
                                                        Select
                                                    </button>
                                                ) : null}
                                                <a
                                                    href={fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{ ...styles.button as React.CSSProperties, textDecoration: 'none', backgroundColor: '#6b7280' }}
                                                >
                                                    Open
                                                </a>
                                                <button
                                                    style={{ ...styles.button, backgroundColor: '#374151' }}
                                                    onClick={() => void navigator.clipboard.writeText(fileUrl)}
                                                >
                                                    Copy URL
                                                </button>
                                                <button
                                                    style={styles.button}
                                                    onClick={() => void handleDelete(item.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {getMedia.data && getMedia.data.totalDocs && getMedia.data.totalDocs > pagination.pageSize && (
                        <div className={css.pagination_container}>
                            <div className={css.pagination_controls}>
                                <button
                                    disabled={pagination.current <= 1}
                                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                                    className={`${css.pagination_button} ${pagination.current <= 1 ? css.pagination_button_disabled : css.pagination_button_primary}`}
                                >
                                    Previous
                                </button>
                                <span className={css.pagination_info}>
                                    {pagination.current} / {Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 10)))}
                                </span>
                                <button
                                    disabled={pagination.current >= Math.ceil((pagination.total || 0) / (pagination.pageSize || 10))}
                                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                                    className={`${css.pagination_button} ${pagination.current >= Math.ceil((pagination.total || 0) / (pagination.pageSize || 10)) ? css.pagination_button_disabled : css.pagination_button_primary}`}
                                >
                                    Next
                                </button>
                            </div>
                            <div className={css.pagination_page_size}>
                                <span className={css.pagination_info}>
                                    Show:
                                </span>
                                <select
                                    value={pagination.pageSize}
                                    onChange={(e) => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), current: 1 }))}
                                    className={css.pagination_select}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                                <span className={css.pagination_info}>
                                    files per page
                                </span>
                            </div>
                            <div className={css.pagination_controls}>
                                <span className={css.pagination_info}>
                                    Showing {((pagination.current - 1) * pagination.pageSize) + 1} - {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total} files
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};