// src/components/pages/PageList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IPage as Page } from '@itmat-broker/itmat-types';
import { trpc } from '../../utils/trpc';
import css from './pages.module.css';
import { message } from 'antd';

export const PublicPagesList: React.FC = () => {
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, __unused_setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');

    const getPages = trpc.page.getPages.useQuery({ limit, page, searchTerm: searchTerm.trim() || undefined });

    useEffect(() => {
        const fetchPages = async () => {
            try {
                if (getPages.data) {
                    setPages(getPages.data.docs as unknown as Page[]);
                    setTotal(getPages.data.totalDocs || 0);
                }
            } catch {
                void message.error('Failed to fetch pages');
            } finally {
                setLoading(false);
            }
        };

        if (getPages.data) {
            void fetchPages();
        } else if (getPages.isError) {
            void message.error('Failed to fetch pages');
            setLoading(false);
        }
    }, [getPages.data, getPages.isError]);

    // Reset to page 1 when search term changes
    useEffect(() => {
        setPage(1);
    }, [searchTerm]);


    if (loading) {
        return (
            <div className={css.page_container}>
                <header className={css.pages_header}>
                    <h1 className={css.pages_title}>Published Pages</h1>
                    <p className={css.pages_subtitle}>Explore our content library</p>
                </header>
                <div className={css.pages_content}>
                    <div className={css.loading}>Loading pages...</div>
                </div>
            </div>
        );
    }

    return (
        <div className={css.page_container}>
            <header className={css.pages_header}>
                <h1 className={css.pages_title}>Published Pages</h1>
                <p className={css.pages_subtitle}>Explore our content library</p>
            </header>

            <div className={css.pages_content}>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by title"
                        style={{ padding: '8px 12px', border: '1px solid #e1e5e9', borderRadius: 4, width: 280 }}
                    />
                </div>
                {pages.length === 0 ? (
                    <div className={css.empty_state}>
                        <h2 className={css.empty_title}>No published pages yet</h2>
                        <p className={css.empty_text}>Check back later for new content!</p>
                    </div>
                ) : (
                    <>
                        <div className={css.pages_grid}>
                            {pages.map(page => (
                                <PageCard key={page.id} page={page} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
                            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                            <span style={{ alignSelf: 'center' }}>{page} / {Math.max(1, Math.ceil(total / limit))}</span>
                            <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Page Card Component
interface PageCardProps {
    page: Page
}

const PageCard: React.FC<PageCardProps> = ({ page }) => {
    const [isHovered, setIsHovered] = useState(false);

    const getExcerpt = (content: string | object) => {
        if (typeof content === 'string') {
            return content.length > 200 ? content.substring(0, 200) + '...' : content;
        }
        return 'Content preview not available';
    };

    return (
        <Link
            to={`/pages/${page.slug}`}
            className={`${css.page_card} ${isHovered ? css.page_card_hover : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={css.page_card_content}>
                <h2 className={css.page_card_title}>{page.title}</h2>
                <p className={css.page_card_excerpt}>
                    {getExcerpt(page.content)}
                </p>
                <div className={css.page_card_meta}>
                    <span className={css.page_date}>
                        {new Date(page.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </span>
                    <span className={css.page_read_more}>Read more →</span>
                </div>
            </div>
        </Link>
    );
};