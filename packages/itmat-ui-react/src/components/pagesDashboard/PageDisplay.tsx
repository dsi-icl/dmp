// src/components/pages/PublicPagesList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IPage as Page, IContentBlock, enumContentBlockType } from '@itmat-broker/itmat-types';
import { useParams } from 'react-router-dom';
import { trpc } from '../../utils/trpc';

export const PageDisplay: React.FC = () => {
    const [page, setPage] = useState<Page | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { slug } = useParams<{ slug: string }>();

    const getPages = trpc.page.getPages.useQuery({ limit: 50 });

    useEffect(() => {
        const fetchPage = async () => {
            if (!slug || !getPages.data) return;

            try {
                // Backend already filters to published pages for public view
                const foundPage = getPages.data.docs.find(p => p.slug === slug);

                if (foundPage) {
                    setPage(foundPage as unknown as Page);
                } else {
                    setError('Page not found');
                }
            } catch (__unused_err) {
                setError('Failed to load page');
            } finally {
                setLoading(false);
            }
        };

        if (getPages.data) {
            void fetchPage();
        } else if (getPages.isError) {
            setError('Failed to load page');
            setLoading(false);
        }
    }, [slug, getPages.data, getPages.isError]);

    const renderContentBlock = (block: IContentBlock, index: number) => {
        switch (block.type) {
            case enumContentBlockType.HERO:
                return (
                    <div key={index} style={{ background: '#000000', color: 'white', padding: '48px 24px', width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            {(block.data.title as string) && (
                                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>{block.data.title as string}</h1>
                            )}
                        </div>
                    </div>
                );

            case enumContentBlockType.TEXT:
                if (Array.isArray(block.data.lines) && block.data.lines.length > 0) {
                    const lines = block.data.lines as Record<string, unknown>[];
                    const spanOf = (ln: Record<string, unknown>) => ln.size === 'third' ? 4 : ln.size === 'half' ? 6 : 12; // 12-col grid
                    return (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', alignItems: 'start', marginBottom: '24px', padding: '0 32px' }}>
                            {lines.map((ln: Record<string, unknown>, i: number) => (
                                <div key={i} style={{ gridColumn: `span ${spanOf(ln)}` }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(Array.isArray(ln.rows) && ln.rows.length > 0 ? ln.rows : [{ text: ln.text, fontSize: ln.fontSize, bold: ln.bold, italic: ln.italic, underline: ln.underline, color: ln.color }]).map((row: Record<string, unknown>, rIdx: number) => (
                                            <div key={rIdx} style={{ whiteSpace: 'pre-wrap', fontSize: (row.fontSize as string) || (ln.fontSize as string) || (block.data.fontSize as string) || '16px', fontWeight: row.bold ? '700' : 'normal', fontStyle: row.italic ? 'italic' : 'normal', textDecoration: row.underline ? 'underline' : 'none', lineHeight: 1.7, color: (row.color as string) || (ln.color as string) || (block.data.color as string) || '#2d3748' }}>
                                                {row.text as string}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                }

                return (
                    <div
                        key={index}
                        style={{
                            fontSize: (block.data.fontSize as string) || '16px',
                            textAlign: ((block.data.textAlign as string) || 'left') as React.CSSProperties['textAlign'],
                            fontWeight: (block.data.fontWeight as string) || 'normal',
                            color: '#2d3748',
                            lineHeight: 1.7,
                            marginBottom: '32px',
                            whiteSpace: 'pre-wrap' as const,
                            maxWidth: '100%',
                            padding: '0 32px'
                        }}
                    >
                        {(block.data.text as string)}
                    </div>
                );

            case enumContentBlockType.MEDIA:
                return (
                    <div
                        key={index}
                        style={{
                            textAlign: ((block.data.alignment as string) || 'center') as React.CSSProperties['textAlign'],
                            marginBottom: '40px',
                            display: 'flex',
                            justifyContent: block.data.alignment === 'left' ? 'flex-start' :
                                block.data.alignment === 'right' ? 'flex-end' : 'center',
                            padding: '0 32px'
                        }}
                    >
                        {(block.data.src as string) && (() => {
                            const fullUrl = (block.data.src as string).startsWith('http') ? block.data.src : `${window.location.origin}${block.data.src}`;
                            const fileExtension = (block.data.src as string).split('.').pop()?.toLowerCase() || '';
                            const mimeType = (block.data.mimeType as string) || '';

                            // Handle PDF files (check both mimeType and file extension)
                            if (mimeType === 'application/pdf' || fileExtension === 'pdf') {
                                return (
                                    <div style={{
                                        width: (block.data.width as string) || '100%',
                                        maxWidth: '100%',
                                        margin: block.data.alignment === 'left' ? '0' :
                                            block.data.alignment === 'right' ? '0 0 0 auto' : '0 auto',
                                        border: '1px solid #e1e5e9',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        backgroundColor: '#ffffff',
                                        textAlign: 'center',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        <div style={{ fontSize: '28px' }}><span role="img" aria-label="document">📄</span></div>
                                        <div style={{ fontWeight: 600, fontSize: '15px', flex: 1, color: '#2d3748' }}>
                                            {(block.data.alt as string) || 'PDF Document'}
                                        </div>
                                        <a
                                            href={fullUrl as string}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-block',
                                                padding: '8px 16px',
                                                backgroundColor: '#48bb78',
                                                color: 'white',
                                                textDecoration: 'none',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 2px 4px rgba(72, 187, 120, 0.2)'
                                            }}
                                        >
                                            Open PDF
                                        </a>
                                    </div>
                                );
                            }

                            // Handle Excel files specifically
                            if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                                mimeType === 'application/vnd.ms-excel' ||
                                ['xlsx', 'xls'].includes(fileExtension || '')) {
                                return (
                                    <div style={{
                                        width: (block.data.width as string) || '100%',
                                        maxWidth: '100%',
                                        margin: block.data.alignment === 'left' ? '0' :
                                            block.data.alignment === 'right' ? '0 0 0 auto' : '0 auto',
                                        border: '1px solid #e1e5e9',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        backgroundColor: '#ffffff',
                                        textAlign: 'center',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        <div style={{ fontSize: '28px' }}><span role="img" aria-label="spreadsheet">📊</span></div>
                                        <div style={{ fontWeight: 600, fontSize: '15px', flex: 1, color: '#2d3748' }}>
                                            {(block.data.alt as string) || 'Excel Spreadsheet'}
                                        </div>
                                        <a
                                            href={fullUrl as string}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-block',
                                                padding: '8px 16px',
                                                backgroundColor: '#48bb78',
                                                color: 'white',
                                                textDecoration: 'none',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 2px 4px rgba(72, 187, 120, 0.2)'
                                            }}
                                        >
                                            Download Excel
                                        </a>
                                    </div>
                                );
                            }

                            // Handle other document types (check both mimeType and file extension)
                            if (mimeType.startsWith('application/msword') ||
                                mimeType.startsWith('application/vnd.openxmlformats-officedocument') ||
                                mimeType === 'text/plain' ||
                                ['doc', 'docx', 'txt', 'rtf', 'xlsx', 'xls'].includes(fileExtension || '')) {
                                return (
                                    <div style={{
                                        width: (block.data.width as string) || '100%',
                                        maxWidth: '100%',
                                        margin: block.data.alignment === 'left' ? '0' :
                                            block.data.alignment === 'right' ? '0 0 0 auto' : '0 auto',
                                        border: '1px solid #e1e5e9',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        backgroundColor: '#ffffff',
                                        textAlign: 'center',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        <div style={{ fontSize: '28px' }}><span role="img" aria-label="document">📄</span></div>
                                        <div style={{ fontWeight: 600, fontSize: '15px', flex: 1, color: '#2d3748' }}>
                                            {(block.data.alt as string) || 'Document'}
                                        </div>
                                        <a
                                            href={fullUrl as string}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-block',
                                                padding: '8px 16px',
                                                backgroundColor: '#48bb78',
                                                color: 'white',
                                                textDecoration: 'none',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 2px 4px rgba(72, 187, 120, 0.2)'
                                            }}
                                        >
                                            Download
                                        </a>
                                    </div>
                                );
                            }

                            // Handle video files
                            if (mimeType.startsWith('video/') || ['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(fileExtension || '')) {
                                return (
                                    <video
                                        controls
                                        style={{
                                            width: (block.data.width as string) || '100%',
                                            height: 'auto',
                                            borderRadius: '12px',
                                            border: '1px solid #e1e5e9',
                                            maxWidth: '100%',
                                            maxHeight: '500px',
                                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        <source src={fullUrl as string} type={(mimeType as string) || 'video/mp4'} />
                                        Your browser does not support the video tag.
                                    </video>
                                );
                            }

                            // Handle audio files
                            if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac'].includes(fileExtension || '')) {
                                return (
                                    <div style={{
                                        width: (block.data.width as string) || '100%',
                                        maxWidth: '100%',
                                        margin: block.data.alignment === 'left' ? '0' :
                                            block.data.alignment === 'right' ? '0 0 0 auto' : '0 auto',
                                        border: '1px solid #e1e5e9',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        backgroundColor: '#ffffff',
                                        textAlign: 'center',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        <div style={{ fontSize: '28px' }}><span role="img" aria-label="audio">🎵</span></div>
                                        <div style={{ fontWeight: 600, fontSize: '15px', flex: 1, color: '#2d3748' }}>
                                            {(block.data.alt as string) || 'Audio File'}
                                        </div>
                                        <audio controls style={{ maxWidth: '200px', borderRadius: '8px' }}>
                                            <source src={fullUrl as string} type={(mimeType as string) || 'audio/mpeg'} />
                                            Your browser does not support the audio tag.
                                        </audio>
                                    </div>
                                );
                            }

                            // Handle images (default)
                            return (
                                <img
                                    src={fullUrl as string}
                                    alt={(block.data.alt as string) || ''}
                                    style={{
                                        width: (block.data.width as string) || '100%',
                                        height: 'auto',
                                        borderRadius: '12px',
                                        border: '1px solid #e1e5e9',
                                        maxWidth: '100%',
                                        maxHeight: '500px',
                                        objectFit: 'contain' as const,
                                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onError={(e) => {
                                        console.error('Image failed to load:', block.data.src);
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                    onLoad={() => {
                                        // Image loaded successfully
                                    }}
                                />
                            );
                        })()}
                    </div>
                );

            case enumContentBlockType.LINK: {
                if (!block.data.text || !block.data.url) return null;

                const linkStyles = {
                    default: {
                        color: '#4b5563',
                        textDecoration: 'none',
                        fontSize: '16px',
                        fontWeight: 600,
                        transition: 'color 0.3s ease',
                        cursor: 'pointer'
                    },
                    button: {
                        display: 'inline-block',
                        padding: '12px 24px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 600,
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        border: 'none',
                        boxShadow: '0 2px 8px rgba(75, 85, 99, 0.2)'
                    },
                    underline: {
                        color: '#4b5563',
                        textDecoration: 'underline',
                        fontSize: '16px',
                        fontWeight: 600,
                        transition: 'color 0.3s ease',
                        cursor: 'pointer'
                    }
                };

                return (
                    <div
                        key={index}
                        style={{
                            textAlign: ((block.data.alignment as string) || 'left') as React.CSSProperties['textAlign'],
                            marginBottom: '32px',
                            padding: '0 32px'
                        }}
                    >
                        <div>
                            <a
                                href={block.data.url as string}
                                target={block.data.openInNewTab ? '_blank' : '_self'}
                                rel={block.data.openInNewTab ? 'noopener noreferrer' : undefined}
                                style={linkStyles[(block.data.style as string) || 'default'] || linkStyles.default}
                                onMouseEnter={(e) => {
                                    if (block.data.style === 'button') {
                                        e.currentTarget.style.backgroundColor = '#4b5563';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(75, 85, 99, 0.3)';
                                    } else {
                                        e.currentTarget.style.color = '#374151';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (block.data.style === 'button') {
                                        e.currentTarget.style.backgroundColor = '#6b7280';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(75, 85, 99, 0.2)';
                                    } else {
                                        e.currentTarget.style.color = '#4b5563';
                                    }
                                }}
                            >
                                {(block.data.text as string)}
                            </a>
                            {(block.data.description as string) && (
                                <div style={{
                                    marginTop: '12px',
                                    fontSize: '15px',
                                    color: '#5f6368',
                                    lineHeight: 1.6,
                                    fontStyle: 'italic'
                                }}>
                                    {(block.data.description as string)}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };


    const styles = {
        fullWindowContainer: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            backgroundColor: '#fafbfc',
            minHeight: '100vh',
            width: '100%',
            margin: 0,
            padding: 0,
            display: 'block',
            overflow: 'auto',
            height: '100vh'
        },
        topPanel: {
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e1e5e9',
            padding: '12px 0',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            flexShrink: 0,
            position: 'sticky' as const,
            top: 0,
            zIndex: 100
        },
        topPanelContent: {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
        },
        backButton: {
            backgroundColor: '#6b7280',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
        },
        pageInfo: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'flex-end',
            textAlign: 'right' as const
        },
        pageTitle: {
            fontSize: '16px',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '2px'
        },
        pageMeta: {
            fontSize: '12px',
            color: '#6b7280',
            fontWeight: 400
        },
        contentContainer: {
            padding: '40px 0',
            width: '100%',
            boxSizing: 'border-box' as const,
            minHeight: 'calc(100vh - 120px)'
        } as React.CSSProperties,
        contentWrapper: {
            width: '100%',
            padding: '0'
        },
        footer: {
            backgroundColor: '#000000',
            borderTop: '1px solid #333333',
            padding: '48px 0',
            marginTop: '60px',
            boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.06)',
            width: '100%'
        },
        footerContent: {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px'
        },
        footerLeft: {
            display: 'flex',
            alignItems: 'center'
        },
        footerBrand: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'flex-start'
        },
        footerBrandText: {
            fontSize: '18px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.2
        },
        footerBrandSubtext: {
            fontSize: '12px',
            color: '#cccccc',
            fontWeight: 400,
            marginTop: '2px'
        },
        footerRight: {
            display: 'flex',
            alignItems: 'center'
        },
        footerMeta: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'flex-end',
            gap: '4px'
        },
        footerMetaItem: {
            fontSize: '12px',
            color: '#cccccc',
            fontWeight: 400
        },
        container: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            backgroundColor: '#fafbfc', // Clean light background
            height: '100vh',
            display: 'flex',
            flexDirection: 'column' as const,
            overflow: 'hidden' as const
        },
        header: {
            background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
            borderBottom: 'none',
            padding: '12px 0',
            flexShrink: 0,
            boxShadow: '0 4px 20px rgba(75, 85, 99, 0.15)'
        },
        headerInner: {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 32px'
        },
        breadcrumb: {
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        breadcrumbLink: {
            color: 'rgba(255, 255, 255, 0.8)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'color 0.3s ease'
        },
        breadcrumbSeparator: {
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '14px'
        },
        breadcrumbCurrent: {
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px',
            fontWeight: 600
        },
        title: {
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.2,
            letterSpacing: '-0.3px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.08)'
        },
        main: {
            flex: 1,
            backgroundColor: '#fafbfc',
            display: 'flex',
            flexDirection: 'column' as const,
            overflowY: 'auto' as const,
            overflowX: 'hidden' as const,
            minHeight: 0,
            maxHeight: '100%'
        },
        content: {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '48px 32px',
            width: '100%',
            boxSizing: 'border-box' as const
        },
        card: {
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            marginBottom: '32px',
            transition: 'box-shadow 0.3s ease'
        },
        cardContent: {
            padding: '32px'
        },
        meta: {
            padding: '24px 48px',
            borderTop: '1px solid #f1f3f4',
            backgroundColor: '#f8f9fa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '14px',
            color: '#5f6368'
        },
        status: {
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: '#e8f5e8',
            color: '#137333',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px'
        },
        errorState: {
            textAlign: 'center' as const,
            padding: '80px 40px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
        },
        errorTitle: {
            margin: '0 0 16px 0',
            fontSize: '28px',
            fontWeight: 700,
            color: '#1a1a1a'
        },
        errorText: {
            margin: '0 0 32px 0',
            fontSize: '16px',
            color: '#5f6368',
            lineHeight: 1.6
        },
        loading: {
            textAlign: 'center' as const,
            padding: '80px 40px',
            fontSize: '16px',
            color: '#5f6368',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e1e5e9',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.main}>
                    <div style={styles.content}>
                        <div style={styles.loading}>Loading page...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !page) {
        return (
            <div style={styles.container}>
                <div style={styles.main}>
                    <div style={styles.content}>
                        <div style={styles.errorState}>
                            <h1 style={styles.errorTitle}>Page Not Found</h1>
                            <p style={styles.errorText}>
                                The page you're looking for doesn't exist or isn't published yet.
                            </p>
                            <Link to="/pages" style={styles.backButton}>
                                ← Back to Pages
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.fullWindowContainer}>
            {/* Small top panel with back button */}
            <div style={styles.topPanel}>
                <div style={styles.topPanelContent}>
                    <Link
                        to="/pages"
                        style={styles.backButton}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#4b5563';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#6b7280';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        ← Back to Pages
                    </Link>
                    <div style={styles.pageInfo}>
                        <span style={styles.pageTitle}>{page.title}</span>
                        <span style={styles.pageMeta}>
                            Author: {page.createdByUsername} • DatePublished: {new Date(page.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main content with proper spacing */}
            <div style={styles.contentContainer}>
                <div style={styles.contentWrapper}>
                    {page?.content && Array.isArray(page.content) ? (
                        <div>
                            {page.content.map((block, index) => renderContentBlock(block, index))}

                        </div>
                    ) : page?.content && typeof page.content === 'string' ? (
                        <div>
                            <div style={{
                                fontSize: '15px',
                                lineHeight: 1.6,
                                color: '#333333',
                                whiteSpace: 'pre-wrap' as const,
                                marginBottom: '24px'
                            }}>
                                {page.content}
                            </div>

                        </div>
                    ) : (
                        <div>
                            <div style={{
                                textAlign: 'center' as const,
                                padding: '60px 20px',
                                color: '#999',
                                fontSize: '16px'
                            }}>
                                No content available
                            </div>

                        </div>
                    )}
                </div>
            </div>

            {/* Footer always at bottom of window */}
            <div style={styles.footer}>
                <div style={styles.footerContent}>
                    <div style={styles.footerLeft}>
                        <div style={styles.footerBrand}>
                            <span style={styles.footerBrandText}>ITMAT</span>
                            <span style={styles.footerBrandSubtext}>Content Management</span>
                        </div>
                    </div>
                    <div style={styles.footerRight}>
                        <div style={styles.footerMeta}>
                            <span style={styles.footerMetaItem}>
                                Author: {page?.createdByUsername || 'Unknown'}
                            </span>
                            <span style={styles.footerMetaItem}>
                                DatePublished: {page?.createdAt ? new Date(page.createdAt).toLocaleDateString() : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};