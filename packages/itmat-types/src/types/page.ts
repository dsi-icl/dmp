import { IBase } from './base';

export enum enumPageStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published'
}

export enum enumContentBlockType {
    TEXT = 'text',
    MEDIA = 'media',
    HERO = 'hero',
    LINK = 'link'
}

export interface IContentBlock {
    id: string;
    type: enumContentBlockType;
    data: Record<string, unknown>; // Flexible data structure for different block types
}

export interface IPage extends IBase {
    title: string;
    content: string | IContentBlock[]; // Can be string or array of content blocks
    slug: string;
    status: enumPageStatus;
    createdBy: string;
    createdByUsername: string;
    createdAt: string;
    updatedAt: string;
}

export interface IMedia extends IBase {
    filename: string;
    url: string;
    alt?: string;
    mimeType: string;
    filesize: number;
    fileData?: string;
    createdBy: string;
    createdByUsername: string;
    createdAt: string;
    updatedAt: string;
}

export interface IPaginatedResponse<T> {
    docs: T[];
    totalDocs: number;
    limit: number;
    page: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

// Content block data interfaces
export interface ITextBlockData {
    text: string;
    fontSize?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    fontWeight?: 'normal' | '500' | '600' | '700';
    color?: string;
    lines?: Array<{
        text: string;
        fontSize?: string;
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        color?: string;
        // Column sizing within a text block layout
        size?: 'full' | 'half' | 'third';
        align?: 'left' | 'center' | 'right';
        rows?: Array<{
            text: string;
            fontSize?: string;
            bold?: boolean;
            italic?: boolean;
            underline?: boolean;
            color?: string;
        }>;
    }>;
}

export interface IMediaBlockData {
    src: string;
    alt?: string;
    width?: string;
    alignment?: 'left' | 'center' | 'right';
    mimeType?: string;
    filename?: string;
}

export interface IHeroBlockData {
    backgroundImage?: string;
    title?: string;
    subtitle?: string;
    titleSize?: string;
    titleColor?: string;
    alignment?: 'left' | 'center' | 'right';
    overlay?: number;
}

export interface ILinkBlockData {
    url: string;
    text: string;
    description?: string;
    style?: 'default' | 'button' | 'underline';
    alignment?: 'left' | 'center' | 'right';
    openInNewTab?: boolean;
}
