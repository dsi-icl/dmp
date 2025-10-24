import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { IPage as Page } from '@itmat-broker/itmat-types';
import { trpc } from '../../../utils/trpc';
import css from '../pageeditor.module.css';

export const PagesList: React.FC = () => {
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });
    const navigate = useNavigate();

    const getPages = trpc.page.getPages.useQuery({ limit: pagination.pageSize, page: pagination.current, adminView: true }, { keepPreviousData: true });
    const deletePageMutation = trpc.page.deletePage.useMutation();

    const fetchPages = useCallback(async (page = 1, pageSize = 10) => {
        setLoading(true);
        try {
            if (getPages.data) {
                setPages(getPages.data.docs as unknown as Page[]);
                setPagination({
                    current: page,
                    pageSize: pageSize,
                    total: getPages.data.totalDocs || (getPages.data.docs?.length || 0)
                });
            }
        } catch {
            void message.error('Failed to fetch pages');
        } finally {
            setLoading(false);
        }
    }, [getPages.data]);

    const handleDelete = async (id: string) => {
        try {
            await deletePageMutation.mutateAsync({ id });
            void message.success('Page deleted successfully');
            void getPages.refetch();
        } catch {
            void message.error('Failed to delete page');
        }
    };

    useEffect(() => {
        void fetchPages(pagination.current, pagination.pageSize);
    }, [fetchPages, pagination.current, pagination.pageSize]);

    const columns = [
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title'
        },
        {
            title: 'Slug',
            dataIndex: 'slug',
            key: 'slug'
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'published' ? 'green' : 'orange'}>
                    {status.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Created By',
            dataIndex: 'createdByUsername',
            key: 'createdByUsername'
        },
        {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: Page) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        style={{
                            padding: '4px 8px',
                            backgroundColor: '#1890ff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                        onClick={() => navigate(`/admin/pages/${record.id}`)}
                    >
                        Edit
                    </button>
                    <button
                        style={{
                            padding: '4px 8px',
                            backgroundColor: '#ff4d4f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this page?')) {
                                void handleDelete(record.id);
                            }
                        }}
                    >
                        Delete
                    </button>
                </div>
            )
        }
    ];

    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    const visibleRows = pages.slice(start, end);

    return (
        <div className={css.pages_tab_container}>
            <div style={{ marginBottom: 16 }}>
                <button
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#52c41a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                    onClick={() => navigate('/admin/pages/new')}
                >
                    + Create New Page
                </button>
            </div>

            <div className={css.pages_table_container}>
                <Table
                    columns={columns}
                    dataSource={visibleRows}
                    loading={loading}
                    rowKey="id"
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: false,
                        position: ['bottomCenter'],
                        onChange: (page) => setPagination(prev => ({ ...prev, current: page }))
                    }}
                />
            </div>
        </div>
    );
};