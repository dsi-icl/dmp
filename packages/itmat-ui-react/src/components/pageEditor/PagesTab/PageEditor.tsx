import React, { useState, useEffect, useCallback } from 'react';
import { IPage as Page, IContentBlock, enumContentBlockType, IFile as Media, enumPageStatus } from '@itmat-broker/itmat-types';
import { trpc } from '../../../utils/trpc';
import { message } from 'antd';

interface PageData {
    title: string
    slug: string
    status: enumPageStatus
    content: IContentBlock[]
}


export const PageEditor: React.FC<{
    editingPage?: Page | null
    onSave: (pageData: PageData) => void
    onCancel: () => void
}> = ({ editingPage, onSave, onCancel }) => {
    const [pageData, setPageData] = useState<PageData>({
        title: '',
        slug: '',
        status: enumPageStatus.DRAFT,
        content: [{
            id: 'default-hero',
            type: enumContentBlockType.HERO,
            data: {
                title: '',
                titleSize: '48px',
                titleColor: '#000',
                alignment: 'center'
            }
        }]
    });
    const [media, setMedia] = useState<Media[]>([]);
    const [showMediaLibrary, setShowMediaLibrary] = useState(false);
    const [selectedBlockId, setSelectedBlockId] = useState<string>('');
    const [titleError, setTitleError] = useState<string>('');
    const [isCheckingTitle, setIsCheckingTitle] = useState(false);

    // Function to generate slug from title
    const generateSlug = (title: string): string => {
        return title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    };

    const getMedia = trpc.page.getMedia.useQuery({ limit: 50, adminView: true });
    const getAllPages = trpc.page.getPages.useQuery({ limit: 1000, adminView: true });

    // Function to check for duplicate title
    const checkTitleAvailability = useCallback((title: string) => {
        if (!title.trim()) {
            setTitleError('');
            return;
        }

        // Don't check if it's the same as the current page being edited
        if (editingPage && editingPage.title === title) {
            setTitleError('');
            return;
        }

        if (!getAllPages.data) {
            return;
        }

        const existingTitle = getAllPages.data.docs.find((page) =>
            (page as unknown as Page)['title']?.toLowerCase().trim() === title.toLowerCase().trim()
        );

        if (existingTitle) {
            setTitleError(`A page with the title "${(existingTitle as unknown as Page)['title']}" already exists. Please choose a different title.`);
        } else {
            setTitleError('');
        }
    }, [getAllPages.data, editingPage]);

    useEffect(() => {
        if (editingPage) {
            const existingContent = Array.isArray(editingPage.content) ? editingPage.content : [];

            // Ensure there's always a hero section at the top
            const hasHero = existingContent.some(block => block.type === enumContentBlockType.HERO);
            let content = existingContent;

            if (!hasHero) {
                const defaultHero = {
                    id: 'default-hero',
                    type: enumContentBlockType.HERO,
                    data: {
                        title: '',
                        titleSize: '48px',
                        titleColor: '#000',
                        alignment: 'center'
                    }
                };
                content = [defaultHero, ...existingContent];
            }

            setPageData({
                title: editingPage.title,
                slug: editingPage.slug,
                status: editingPage.status,
                content: content
            });
        }
    }, [editingPage]);

    const fetchMedia = useCallback(async () => {
        try {
            if (getMedia.data) {
                setMedia(getMedia.data.docs as unknown as Media[]);
            }
        } catch {
            void message.error('Failed to fetch media');
        }
    }, [getMedia.data]);

    useEffect(() => {
        void fetchMedia();
    }, [fetchMedia, getMedia.data]);

    useEffect(() => {
        setIsCheckingTitle(getAllPages.isLoading);

        const timeoutId = setTimeout(() => {
            if (pageData.title && !getAllPages.isLoading) {
                checkTitleAvailability(pageData.title);
            }
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(timeoutId);
    }, [pageData.title, editingPage, getAllPages.data, getAllPages.isLoading, checkTitleAvailability]);

    const addBlock = (type: IContentBlock['type']) => {
        // Prevent adding multiple hero sections or hero sections not at the top
        if (type === enumContentBlockType.HERO) {
            const hasHero = pageData.content.some(block => block.type === enumContentBlockType.HERO);
            if (hasHero) {
                alert('A hero section already exists and must be at the top of the page.');
                return;
            }
        }

        const newBlock: IContentBlock = {
            id: Date.now().toString(),
            type,
            data: getDefaultBlockData(type)
        };

        // If adding a hero section, it must be at the top
        if (type === enumContentBlockType.HERO) {
            setPageData(prev => ({
                ...prev,
                content: [newBlock, ...prev.content]
            }));
        } else {
            setPageData(prev => ({
                ...prev,
                content: [...prev.content, newBlock]
            }));
        }
    };

    const getDefaultBlockData = (type: IContentBlock['type']) => {
        switch (type) {
            case enumContentBlockType.TEXT:
                return { text: '', fontSize: '16px', textAlign: 'left', fontWeight: 'normal', lines: [{ text: '' }] };
            case enumContentBlockType.MEDIA:
                return { src: '', alt: '', width: '100%', alignment: 'center' };
            case enumContentBlockType.HERO:
                return {
                    title: '',
                    titleSize: '48px',
                    titleColor: '#000',
                    alignment: 'center'
                };
            case enumContentBlockType.LINK:
                return {
                    text: 'Click here',
                    url: '',
                    description: '',
                    openInNewTab: false,
                    alignment: 'left',
                    style: 'default'
                };
            default:
                return {};
        }
    };

    const updateBlock = (id: string, data: Record<string, unknown>) => {
        setPageData(prev => ({
            ...prev,
            content: prev.content.map(block =>
                block.id === id ? { ...block, data: { ...block.data, ...data } } : block
            )
        }));
    };

    const removeBlock = (id: string) => {
        const blockToRemove = pageData.content.find(block => block.id === id);
        if (blockToRemove && blockToRemove.type === enumContentBlockType.HERO) {
            alert('Hero section cannot be removed as it is required at the top of the page.');
            return;
        }

        setPageData(prev => ({
            ...prev,
            content: prev.content.filter(block => block.id !== id)
        }));
    };

    const moveBlock = (id: string, direction: 'up' | 'down') => {
        setPageData((prev: PageData) => {
            const blocks = [...prev.content];
            const index = blocks.findIndex(block => block.id === id);
            if (index === -1) return prev;

            // Prevent moving hero section away from the top
            if (blocks[index].type === enumContentBlockType.HERO && direction === 'down') {
                alert('Hero section must remain at the top of the page.');
                return prev;
            }

            // Prevent moving other blocks above the hero section
            if (blocks[index].type !== enumContentBlockType.HERO && direction === 'up' && index === 1 && blocks[0].type === enumContentBlockType.HERO) {
                alert('No content can be placed above the hero section.');
                return prev;
            }

            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= blocks.length) return prev;

            const temp = blocks[index];
            blocks[index] = blocks[newIndex];
            blocks[newIndex] = temp;
            return { ...prev, content: blocks };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!pageData.title.trim()) {
            alert('Page title is required.');
            return;
        }

        // Don't submit if there's a title error
        if (titleError) {
            alert('Please fix the title error before saving.');
            return;
        }

        // Don't submit if we're still checking the title
        if (isCheckingTitle) {
            alert('Please wait while we validate the title.');
            return;
        }

        onSave(pageData);
    };

    const selectMedia = (mediaItem: Media) => {
        if (selectedBlockId) {
            updateBlock(selectedBlockId, {
                src: `/file/${mediaItem.id}`,
                alt: mediaItem.fileName,
                mimeType: getMimeTypeFromFileType(mediaItem.fileType),
                filename: mediaItem.fileName
            });
            setShowMediaLibrary(false);
            setSelectedBlockId('');
        }
    };

    const getMimeTypeFromFileType = (fileType: string): string => {
        switch (fileType) {
            case 'JPEG':
            case 'JPG':
                return 'image/jpeg';
            case 'PNG':
                return 'image/png';
            case 'GIF':
                return 'image/gif';
            case 'WEBP':
                return 'image/webp';
            case 'MP4':
                return 'video/mp4';
            case 'AVI':
                return 'video/avi';
            case 'PDF':
                return 'application/pdf';
            case 'DOCX':
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case 'XLSX':
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            case 'XLS':
                return 'application/vnd.ms-excel';
            case 'TXT':
                return 'text/plain';
            default:
                return 'application/octet-stream';
        }
    };



    const styles = {
        container: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            backgroundColor: '#fafafa',
            height: '100%',
            display: 'flex',
            flexDirection: 'column' as const,
            overflow: 'hidden'
        },
        header: {
            backgroundColor: 'white',
            borderBottom: '1px solid #e1e5e9',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '72px',
            flexShrink: 0
        },
        title: {
            margin: 0,
            fontSize: '18px',
            fontWeight: 600
        },
        headerActions: {
            display: 'flex',
            gap: '8px'
        },
        button: {
            backgroundColor: '#000',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
        },
        buttonSecondary: {
            backgroundColor: 'white',
            color: '#000',
            border: '1px solid #e1e5e9'
        },
        content: {
            display: 'grid',
            gridTemplateColumns: '1fr 300px',
            gap: '20px',
            padding: '20px',
            maxWidth: '1400px',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box' as const,
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
        },
        mainPanel: {
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #e1e5e9',
            display: 'flex',
            flexDirection: 'column' as const,
            maxHeight: 'calc(100vh - 250px)',
            overflow: 'hidden'
        },
        sidebar: {
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #e1e5e9',
            overflowY: 'auto' as const,
            maxHeight: 'calc(100vh - 450px)'
        },
        formSection: {
            padding: '20px',
            borderBottom: '1px solid #f5f5f5',
            flexShrink: 0
        },
        label: {
            display: 'block',
            marginBottom: '4px',
            fontSize: '14px',
            fontWeight: 500
        },
        input: {
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #e1e5e9',
            borderRadius: '4px',
            fontSize: '14px',
            marginBottom: '12px',
            boxSizing: 'border-box' as const
        },
        inputError: {
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #dc3545',
            borderRadius: '4px',
            fontSize: '14px',
            marginBottom: '4px',
            boxSizing: 'border-box' as const,
            backgroundColor: '#fff5f5'
        },
        errorMessage: {
            color: '#dc3545',
            fontSize: '12px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        },
        checkingMessage: {
            color: '#666',
            fontSize: '12px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        },
        blocksContainer: {
            padding: '20px',
            overflowY: 'auto' as const,
            overflowX: 'hidden' as const,
            flex: 1,
            minHeight: 0,
            maxHeight: 'calc(100vh - 450px)'
        },
        blocksList: {
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '16px',
            paddingBottom: '40px'
        },
        block: {
            border: '1px solid #e1e5e9',
            borderRadius: '6px',
            overflow: 'hidden' as const,
            backgroundColor: 'white'
        },
        blockHeader: {
            padding: '12px 16px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e1e5e9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        },
        blockType: {
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            color: '#666'
        },
        blockActions: {
            display: 'flex',
            gap: '4px'
        },
        blockContent: {
            padding: '16px'
        },
        addBlocksSection: {
            padding: '20px'
        },
        addBlockButton: {
            width: '100%',
            padding: '12px',
            margin: '4px 0',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e1e5e9',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            textAlign: 'left' as const
        },
        mediaLibrary: {
            position: 'fixed' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        },
        mediaModal: {
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '800px',
            maxHeight: '600px',
            overflow: 'auto' as const,
            width: '90%'
        },
        mediaGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '12px',
            marginTop: '16px'
        },
        mediaItem: {
            border: '1px solid #e1e5e9',
            borderRadius: '4px',
            overflow: 'hidden' as const,
            cursor: 'pointer',
            transition: 'all 0.2s'
        },
        mediaPreview: {
            width: '100%',
            height: '100px',
            objectFit: 'cover' as const
        }
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>
                    {editingPage ? `Edit: ${editingPage.title}` : 'Create New Page'}
                </h1>
                <div style={styles.headerActions}>
                    <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        style={{
                            ...styles.button,
                            opacity: (titleError || isCheckingTitle) ? 0.5 : 1,
                            cursor: (titleError || isCheckingTitle) ? 'not-allowed' : 'pointer'
                        }}
                        onClick={handleSubmit}
                        disabled={!!titleError || isCheckingTitle}
                    >
                        {editingPage ? 'Update' : 'Create'}
                    </button>
                </div>
            </header>

            <div style={styles.content}>
                <div style={styles.mainPanel}>
                    <div style={styles.formSection}>
                        <label style={styles.label}>Page Title</label>
                        <input
                            style={titleError ? styles.inputError : styles.input}
                            value={pageData.title}
                            onChange={(e) => {
                                const newTitle = e.target.value;
                                const newSlug = generateSlug(newTitle);
                                setPageData(prev => ({ ...prev, title: newTitle, slug: newSlug }));
                            }}
                            placeholder="Enter page title"
                            required
                        />
                        {isCheckingTitle && (
                            <div style={styles.checkingMessage}>
                                <span role="img" aria-label="loading">⏳</span>
                                Checking title availability...
                            </div>
                        )}
                        {titleError && (
                            <div style={styles.errorMessage}>
                                <span role="img" aria-label="warning">⚠️</span>
                                {titleError}
                            </div>
                        )}


                        <label style={styles.label}>Status</label>
                        <select
                            style={styles.input}
                            value={pageData.status}
                            onChange={(e) => setPageData(prev => ({ ...prev, status: e.target.value as enumPageStatus }))}
                        >
                            <option value={enumPageStatus.DRAFT}>Draft</option>
                            <option value={enumPageStatus.PUBLISHED}>Published</option>
                        </select>
                    </div>

                    <div style={styles.blocksContainer}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Content Blocks</h3>
                        <div style={styles.blocksList}>
                            {pageData.content.map((block, index) => (
                                <BlockEditor
                                    key={block.id}
                                    block={block}
                                    index={index}
                                    totalBlocks={pageData.content.length}
                                    onUpdate={(data) => updateBlock(block.id, data)}
                                    onRemove={() => removeBlock(block.id)}
                                    onMove={(direction) => moveBlock(block.id, direction)}
                                    onSelectMedia={() => {
                                        setSelectedBlockId(block.id);
                                        setShowMediaLibrary(true);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div style={styles.sidebar}>
                    <div style={styles.addBlocksSection}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Add Content Block</h3>
                        <button style={styles.addBlockButton} onClick={() => addBlock(enumContentBlockType.HERO)}>
                            + Header Section
                        </button>
                        <button style={styles.addBlockButton} onClick={() => addBlock(enumContentBlockType.TEXT)}>
                            + Text Block
                        </button>
                        <button style={styles.addBlockButton} onClick={() => addBlock(enumContentBlockType.MEDIA)}>
                            + Media
                        </button>
                        <button style={styles.addBlockButton} onClick={() => addBlock(enumContentBlockType.LINK)}>
                            + Link
                        </button>
                    </div>
                </div>
            </div>

            {showMediaLibrary && (
                <div style={styles.mediaLibrary} onClick={() => setShowMediaLibrary(false)}>
                    <div style={styles.mediaModal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 16px 0' }}>Select Media</h3>
                        <div style={styles.mediaGrid}>
                            {media.map(item => (
                                <div
                                    key={item.id}
                                    style={styles.mediaItem}
                                    onClick={() => selectMedia(item)}
                                >
                                    {getMimeTypeFromFileType(item.fileType).startsWith('image/') ? (
                                        <img src={`/file/${item.id}`} alt={item.fileName} style={styles.mediaPreview} />
                                    ) : (
                                        <div style={{
                                            ...styles.mediaPreview,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#f5f5f5'
                                        }}>
                                            <span role="img" aria-label="document">📄</span>
                                        </div>
                                    )}
                                    <div style={{ padding: '8px', fontSize: '12px' }}>
                                        {item.fileName}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Block Editor Component
interface BlockEditorProps {
    block: IContentBlock
    index: number
    totalBlocks: number
    onUpdate: (data: Record<string, unknown>) => void
    onRemove: () => void
    onMove: (direction: 'up' | 'down') => void
    onSelectMedia: () => void
}

const BlockEditor: React.FC<BlockEditorProps> = ({
    block,
    index,
    totalBlocks,
    onUpdate,
    onRemove,
    onMove,
    onSelectMedia
}) => {
    const styles = {
        label: {
            display: 'block',
            marginBottom: '4px',
            fontSize: '14px',
            fontWeight: 500
        },
        input: {
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #e1e5e9',
            borderRadius: '4px',
            fontSize: '14px',
            marginBottom: '12px',
            boxSizing: 'border-box' as const
        },
        button: {
            backgroundColor: '#000',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
        },
        block: {
            border: '1px solid #e1e5e9',
            borderRadius: '6px',
            overflow: 'hidden' as const,
            backgroundColor: 'white'
        },
        blockHeader: {
            padding: '12px 16px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e1e5e9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        },
        blockType: {
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            color: '#666'
        },
        blockActions: {
            display: 'flex',
            gap: '4px'
        },
        blockContent: {
            padding: '16px'
        }
    };

    const renderBlockEditor = () => {
        switch (block.type) {
            case enumContentBlockType.HERO:
                return (
                    <div>
                        <label style={styles.label}>Title</label>
                        <input
                            style={styles.input}
                            value={(block.data.title as string) || ''}
                            onChange={(e) => onUpdate({ title: e.target.value })}
                            placeholder="Hero title"
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={styles.label}>Title Size</label>
                                <select
                                    style={styles.input}
                                    value={(block.data.titleSize as string) || '48px'}
                                    onChange={(e) => onUpdate({ titleSize: e.target.value })}
                                >
                                    <option value="32px">Small</option>
                                    <option value="48px">Medium</option>
                                    <option value="64px">Large</option>
                                    <option value="80px">Extra Large</option>
                                </select>
                            </div>
                            <div>
                                <label style={styles.label}>Alignment</label>
                                <select
                                    style={styles.input}
                                    value={(block.data.alignment as string) || 'center'}
                                    onChange={(e) => onUpdate({ alignment: e.target.value })}
                                >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                    <option value="right">Right</option>
                                </select>
                            </div>
                        </div>
                    </div>
                );

            case enumContentBlockType.TEXT:
                return (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>Column</div>
                        </div>

                        <div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>Edit columns. Whitespace and line breaks are preserved on publish.</div>
                            {(Array.isArray(block.data.lines) && block.data.lines.length > 0 ? block.data.lines : [{ text: '' }]).map((ln: Record<string, unknown>, i: number) => (
                                <div key={i} style={{ border: '1px solid #e1e5e9', borderRadius: '8px', padding: '12px', marginBottom: '12px', background: '#fff' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginRight: '8px' }}>Column {i + 1}</div>
                                        <select
                                            style={{ ...styles.input, marginBottom: 0, width: '140px' }}
                                            value={(ln.size as string) || 'full'}
                                            onChange={(e) => {
                                                const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                                const val = e.target.value as 'full' | 'half' | 'third';
                                                lines[i] = { ...lines[i], size: val };
                                                onUpdate({ lines });
                                            }}
                                        >
                                            <option value="full">Full width</option>
                                            <option value="half">Half width</option>
                                            <option value="third">One third</option>
                                        </select>
                                        <div style={{ flex: 1 }} />
                                        <button type="button" style={{ ...styles.button, padding: '4px 8px', fontSize: '12px' }} onClick={() => {
                                            if (i === 0) return;
                                            const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                            const tmp = lines[i - 1];
                                            lines[i - 1] = lines[i];
                                            lines[i] = tmp;
                                            onUpdate({ lines });
                                        }}>↑</button>
                                        <button type="button" style={{ ...styles.button, padding: '4px 8px', fontSize: '12px' }} onClick={() => {
                                            if (i >= (block.data.lines as Record<string, unknown>[] || []).length - 1) return;
                                            const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                            const tmp = lines[i + 1];
                                            lines[i + 1] = lines[i];
                                            lines[i] = tmp;
                                            onUpdate({ lines });
                                        }}>↓</button>
                                        <button type="button" style={{ ...styles.button, backgroundColor: '#dc3545', padding: '4px 8px', fontSize: '12px' }} onClick={() => {
                                            const lines = (block.data.lines as Record<string, unknown>[] || []).filter((_ln: Record<string, unknown>, idx: number) => idx !== i);
                                            onUpdate({ lines });
                                        }}>✕</button>
                                    </div>
                                    {/* Rows inside a column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {((ln.rows as Record<string, unknown>[]) || [{ text: ln.text || '' }]).map((row: Record<string, unknown>, rIdx: number) => (
                                            <div key={rIdx}>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                                                    <select
                                                        style={{ ...styles.input, marginBottom: 0, width: '120px' }}
                                                        value={(row.fontSize as string) || '16px'}
                                                        onChange={(e) => {
                                                            const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                                            const rows = [...(lines[i].rows as Record<string, unknown>[] || [{ text: lines[i].text || '' }])];
                                                            rows[rIdx] = { ...rows[rIdx], fontSize: e.target.value };
                                                            lines[i] = { ...lines[i], rows };
                                                            onUpdate({ lines });
                                                        }}
                                                    >
                                                        <option value="16px">Normal</option>
                                                        <option value="18px">Heading 3</option>
                                                        <option value="24px">Heading 2</option>
                                                        <option value="32px">Heading 1</option>
                                                    </select>
                                                    <button type="button" title="Bold" style={{
                                                        ...styles.button,
                                                        padding: '4px 8px',
                                                        backgroundColor: row.bold ? '#6b7280' : '#f3f4f6',
                                                        color: row.bold ? '#ffffff' : '#374151',
                                                        border: row.bold ? '2px solid #6b7280' : '2px solid #d1d5db',
                                                        boxShadow: row.bold ? '0 0 8px rgba(107, 114, 128, 0.6), 0 0 16px rgba(107, 114, 128, 0.3)' : 'none',
                                                        filter: row.bold ? 'blur(0.5px)' : 'none',
                                                        transform: row.bold ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }} onClick={() => {
                                                        const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                                        const rows = [...(lines[i].rows as Record<string, unknown>[] || [{ text: lines[i].text || '' }])];
                                                        rows[rIdx] = { ...rows[rIdx], bold: !rows[rIdx]?.bold };
                                                        lines[i] = { ...lines[i], rows };
                                                        onUpdate({ lines });
                                                    }}>B</button>
                                                    <button type="button" title="Italic" style={{
                                                        ...styles.button,
                                                        padding: '4px 8px',
                                                        backgroundColor: row.italic ? '#6b7280' : '#f3f4f6',
                                                        color: row.italic ? '#ffffff' : '#374151',
                                                        border: row.italic ? '2px solid #6b7280' : '2px solid #d1d5db',
                                                        boxShadow: row.italic ? '0 0 8px rgba(107, 114, 128, 0.6), 0 0 16px rgba(107, 114, 128, 0.3)' : 'none',
                                                        filter: row.italic ? 'blur(0.5px)' : 'none',
                                                        transform: row.italic ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }} onClick={() => {
                                                        const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                                        const rows = [...(lines[i].rows as Record<string, unknown>[] || [{ text: lines[i].text || '' }])];
                                                        rows[rIdx] = { ...rows[rIdx], italic: !rows[rIdx]?.italic };
                                                        lines[i] = { ...lines[i], rows };
                                                        onUpdate({ lines });
                                                    }}><span style={{ fontStyle: 'italic' }}>I</span></button>
                                                    <button type="button" title="Underline" style={{
                                                        ...styles.button,
                                                        padding: '4px 8px',
                                                        backgroundColor: row.underline ? '#6b7280' : '#f3f4f6',
                                                        color: row.underline ? '#ffffff' : '#374151',
                                                        border: row.underline ? '2px solid #6b7280' : '2px solid #d1d5db',
                                                        boxShadow: row.underline ? '0 0 8px rgba(107, 114, 128, 0.6), 0 0 16px rgba(107, 114, 128, 0.3)' : 'none',
                                                        filter: row.underline ? 'blur(0.5px)' : 'none',
                                                        transform: row.underline ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }} onClick={() => {
                                                        const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                                        const rows = [...(lines[i].rows as Record<string, unknown>[] || [{ text: lines[i].text || '' }])];
                                                        rows[rIdx] = { ...rows[rIdx], underline: !rows[rIdx]?.underline };
                                                        lines[i] = { ...lines[i], rows };
                                                        onUpdate({ lines });
                                                    }}><span style={{ textDecoration: 'underline' }}>U</span></button>
                                                </div>
                                                <textarea
                                                    style={{ ...styles.input, marginBottom: 0, minHeight: '80px', resize: 'vertical', whiteSpace: 'pre-wrap' as const }}
                                                    value={(row.text as string) || ''}
                                                    onChange={(e) => {
                                                        const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                                        const rows = [...(lines[i].rows as Record<string, unknown>[] || [{ text: lines[i].text || '' }])];
                                                        rows[rIdx] = { ...rows[rIdx], text: e.target.value };
                                                        lines[i] = { ...lines[i], rows };
                                                        onUpdate({ lines });
                                                    }}
                                                    placeholder={`Row ${rIdx + 1}`}
                                                />
                                            </div>
                                        ))}
                                        <button type="button" style={{ ...styles.button, padding: '6px 10px' }} onClick={() => {
                                            const lines = [...(block.data.lines as Record<string, unknown>[] || [])];
                                            const rows = [...(lines[i].rows as Record<string, unknown>[] || [{ text: lines[i].text || '' }])];
                                            rows.push({ text: '' });
                                            lines[i] = { ...lines[i], rows };
                                            onUpdate({ lines });
                                        }}>+ Add row</button>
                                    </div>
                                </div>
                            ))}
                            <button
                                type="button"
                                style={{ ...styles.button, padding: '8px 12px' }}
                                onClick={() => {
                                    const lines = [...(block.data.lines as Record<string, unknown>[] || []), { text: '' }];
                                    onUpdate({ lines });
                                }}
                            >
                                + Add column
                            </button>
                        </div>
                    </div>
                );

            case enumContentBlockType.MEDIA:
                return (
                    <div>
                        <label style={styles.label}>Media</label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <input
                                style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                                value={(block.data.src as string) || ''}
                                onChange={(e) => onUpdate({ src: e.target.value })}
                                placeholder="Media URL"
                            />
                            <button
                                style={{ ...styles.button, padding: '8px 12px' }}
                                onClick={onSelectMedia}
                            >
                                Browse
                            </button>
                        </div>

                        <label style={styles.label}>Alt Text</label>
                        <input
                            style={styles.input}
                            value={(block.data.alt as string) || ''}
                            onChange={(e) => onUpdate({ alt: e.target.value })}
                            placeholder="Alternative text"
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <label style={styles.label}>Width</label>
                                <select
                                    style={styles.input}
                                    value={(block.data.width as string) || '100%'}
                                    onChange={(e) => onUpdate({ width: e.target.value })}
                                >
                                    <option value="50%">50%</option>
                                    <option value="75%">75%</option>
                                    <option value="100%">100%</option>
                                    <option value="auto">Auto</option>
                                </select>
                            </div>
                            <div>
                                <label style={styles.label}>Alignment</label>
                                <select
                                    style={styles.input}
                                    value={(block.data.alignment as string) || 'center'}
                                    onChange={(e) => onUpdate({ alignment: e.target.value })}
                                >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                    <option value="right">Right</option>
                                </select>
                            </div>
                        </div>

                        {(block.data.src as string) && (
                            <div style={{ marginTop: '12px' }}>
                                <img
                                    src={block.data.src as string}
                                    alt={block.data.alt as string}
                                    style={{
                                        maxWidth: '100%',
                                        height: 'auto',
                                        borderRadius: '4px',
                                        border: '1px solid #e1e5e9'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                );

            case enumContentBlockType.LINK:
                return (
                    <div>
                        <label style={styles.label}>URL *</label>
                        <input
                            style={styles.input}
                            value={(block.data.url as string) || ''}
                            onChange={(e) => onUpdate({ url: e.target.value })}
                            placeholder="https://www.sciencedirect.com"
                        />

                        <label style={styles.label}>Label *</label>
                        <input
                            style={styles.input}
                            value={(block.data.text as string) || ''}
                            onChange={(e) => onUpdate({ text: e.target.value })}
                            placeholder="Paper 1"
                        />

                        <label style={styles.label}>Description</label>
                        <textarea
                            style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                            value={(block.data.description as string) || ''}
                            onChange={(e) => onUpdate({ description: e.target.value })}
                            placeholder="Add a brief description about this link (optional)"
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                            <div>
                                <label style={styles.label}>Style</label>
                                <select
                                    style={styles.input}
                                    value={(block.data.style as string) || 'default'}
                                    onChange={(e) => onUpdate({ style: e.target.value })}
                                >
                                    <option value="default">Default Link</option>
                                    <option value="button">Button</option>
                                    <option value="underline">Underlined</option>
                                </select>
                            </div>
                            <div>
                                <label style={styles.label}>Alignment</label>
                                <select
                                    style={styles.input}
                                    value={(block.data.alignment as string) || 'left'}
                                    onChange={(e) => onUpdate({ alignment: e.target.value })}
                                >
                                    <option value="left">Left</option>
                                    <option value="center">Center</option>
                                    <option value="right">Right</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                <input
                                    type="checkbox"
                                    checked={(block.data.openInNewTab as boolean) || false}
                                    onChange={(e) => onUpdate({ openInNewTab: e.target.checked })}
                                />
                                Open in new tab
                            </label>
                        </div>

                        {(block.data.url as string) && (block.data.text as string) && (
                            <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e1e5e9' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    Preview
                                </div>
                                <div style={{ textAlign: ((block.data.alignment as string) || 'left') as React.CSSProperties['textAlign'] }}>
                                    {(block.data.style as string) === 'button' ? (
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '10px 20px',
                                            backgroundColor: '#333333',
                                            color: 'white',
                                            textDecoration: 'none',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            cursor: 'pointer'
                                        }}>
                                            {(block.data.text as string)}
                                        </span>
                                    ) : (
                                        <span style={{
                                            color: '#0066cc',
                                            textDecoration: (block.data.style as string) === 'underline' ? 'underline' : 'none',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}>
                                            {(block.data.text as string)}
                                        </span>
                                    )}
                                    {(block.data.description as string) && (
                                        <div style={{
                                            marginTop: '8px',
                                            fontSize: '12px',
                                            color: '#666',
                                            fontStyle: 'italic'
                                        }}>
                                            {(block.data.description as string)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );

            default:
                return <div>Unknown block type</div>;
        }
    };

    return (
        <div style={styles.block}>
            <div style={styles.blockHeader}>
                <span style={styles.blockType}>{block.type}</span>
                <div style={styles.blockActions}>
                    {index > 0 && (
                        <button
                            style={{ ...styles.button, padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => onMove('up')}
                        >
                            ↑
                        </button>
                    )}
                    {index < totalBlocks - 1 && (
                        <button
                            style={{ ...styles.button, padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => onMove('down')}
                        >
                            ↓
                        </button>
                    )}
                    <button
                        style={{ ...styles.button, backgroundColor: '#dc3545', padding: '4px 8px', fontSize: '12px' }}
                        onClick={onRemove}
                    >
                        ✕
                    </button>
                </div>
            </div>
            <div style={styles.blockContent}>
                {renderBlockEditor()}
            </div>
        </div>
    );
};