import { DBType } from '../database/database';
import { v4 as uuid } from 'uuid';
import { enumUserTypes, enumFileCategories, enumFileTypes, FileUpload, IUserWithoutToken, IFile, CoreError, enumCoreErrors, IPage, IContentBlock, enumPageStatus } from '@itmat-broker/itmat-types';
import { FileCore } from './fileCore';
import { ObjectStore } from '@itmat-broker/itmat-commons';

export interface PageData {
    title: string;
    slug: string;
    status: enumPageStatus;
    content: string | IContentBlock[];
}

export interface MediaData {
    filename: string;
    mimeType: string;
    filesize: number;
    alt?: string;
    buffer: Buffer;
}

export class PageCore {
    db: DBType;
    objStore: ObjectStore;
    fileCore: FileCore;

    constructor(db: DBType, objStore: ObjectStore) {
        this.db = db;
        this.objStore = objStore;
        this.fileCore = new FileCore(db, objStore);
    }

    async getPages(limit = 50, page = 1, requester?: IUserWithoutToken, adminView = false, searchTerm?: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const skip = (page - 1) * limit;
        const collection = this.db.collections.page_collection;

        // Build query based on user permissions
        const query: Record<string, unknown> = {};

        if (adminView) {
            // In admin dashboard: show based on user type
            if (requester.type === enumUserTypes.STANDARD) {
                // Standard users only see their own pages in admin view
                query['createdBy'] = requester.id;
            }
            // Admin sees all pages (no filter)
        } else {
            // Public view: everyone sees only published pages
            query['status'] = 'published';
        }

        if (searchTerm && searchTerm.trim()) {
            query['$or'] = [
                { title: { $regex: searchTerm.trim(), $options: 'i' } },
                { slug: { $regex: searchTerm.trim(), $options: 'i' } }
            ];
        }

        const [docs, totalDocs] = await Promise.all([
            collection.find(query).skip(skip).limit(limit).toArray(),
            collection.countDocuments(query)
        ]);

        return {
            docs,
            totalDocs,
            limit,
            page,
            totalPages: Math.ceil(totalDocs / limit),
            hasNextPage: page < Math.ceil(totalDocs / limit),
            hasPrevPage: page > 1
        };
    }

    async getPageById(id: string, requester?: IUserWithoutToken) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const collection = this.db.collections.page_collection;

        const query: Record<string, unknown> = { id };
        if (requester.type === enumUserTypes.STANDARD) {
            query['createdBy'] = requester.id;
        }

        const page = await collection.findOne(query);
        if (!page) {
            throw new CoreError(enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, 'Page not found or access denied');
        }
        return page;
    }

    async createPage(data: PageData, requester: IUserWithoutToken) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN && requester.type !== enumUserTypes.STANDARD) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'User not authorized');
        }

        const collection = this.db.collections.page_collection;

        const pageDoc = {
            id: uuid(),
            ...data,
            createdBy: requester.id,
            createdByUsername: requester.username,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };

        await collection.insertOne(pageDoc as IPage);
        return pageDoc;
    }

    async updatePage(id: string, data: Partial<PageData>, requester?: IUserWithoutToken) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN && requester.type !== enumUserTypes.STANDARD) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'User not authorized');
        }

        const collection = this.db.collections.page_collection;

        const query: Record<string, unknown> = { id };
        if (requester.type === enumUserTypes.STANDARD) {
            query['createdBy'] = requester.id;
        }

        const existingPage = await collection.findOne(query);
        if (!existingPage) {
            throw new CoreError(enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, 'Page not found or access denied');
        }

        const updateData = {
            ...data,
            updatedAt: new Date().toISOString()
        };

        const result = await collection.findOneAndUpdate(
            query,
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new CoreError(enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, 'Page not found');
        }

        return result;
    }

    async deletePage(id: string, requester?: IUserWithoutToken) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN && requester.type !== enumUserTypes.STANDARD) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'User not authorized');
        }

        const collection = this.db.collections.page_collection;

        const query: Record<string, unknown> = { id };
        if (requester.type === enumUserTypes.STANDARD) {
            query['createdBy'] = requester.id;
        }

        const result = await collection.deleteOne(query);

        if (result.deletedCount === 0) {
            throw new CoreError(enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, 'Page not found or access denied');
        }

        return { success: true };
    }


    /**
     * Upload a media file for page content.
     */
    async uploadMediaFile(
        requester: IUserWithoutToken,
        fileUpload: FileUpload,
        alt?: string
    ): Promise<IFile> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN && requester.type !== enumUserTypes.STANDARD) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'User not authorized');
        }

        return await this.fileCore.uploadFile(
            requester,
            null, // studyId = null (not study-related)
            null, // userId = null (not user-specific)
            fileUpload,
            this.getFileTypeFromMimeType(fileUpload.mimetype),
            enumFileCategories.PAGE_MEDIA_FILE,
            alt
        );
    }

    /**
     * Get media files with pagination and filtering.
     */
    async getMedia(
        limit = 50,
        page = 1,
        requester?: IUserWithoutToken,
        adminView = false
    ): Promise<{ docs: IFile[], totalDocs: number, page: number, totalPages: number }> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN && requester.type !== enumUserTypes.STANDARD) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'User not authorized');
        }

        const collection = this.db.collections.files_collection;

        const query: Record<string, unknown> = {
            'fileCategory': enumFileCategories.PAGE_MEDIA_FILE,
            'life.deletedTime': null
        };

        if (adminView) {
            if (requester.type === enumUserTypes.STANDARD) {
                query['life.createdUser'] = requester.id;
            }
        }

        const skip = (page - 1) * limit;

        const [docs, totalDocs] = await Promise.all([
            collection.find(query)
                .sort({ 'life.createdTime': -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            collection.countDocuments(query)
        ]);

        return {
            docs: docs as unknown as IFile[],
            totalDocs,
            page,
            totalPages: Math.ceil(totalDocs / limit)
        };
    }

    /**
     * Get a single media file by ID.
     */
    async getMediaById(id: string): Promise<IFile | null> {
        const collection = this.db.collections.files_collection;
        const media = await collection.findOne({
            id,
            'fileCategory': enumFileCategories.PAGE_MEDIA_FILE,
            'life.deletedTime': null
        });
        return media as IFile | null;
    }

    /**
     * Get a single media file by filename.
     */
    async getMediaByFilename(filename: string): Promise<IFile | null> {
        const collection = this.db.collections.files_collection;
        const media = await collection.findOne({
            'fileName': filename,
            'fileCategory': enumFileCategories.PAGE_MEDIA_FILE,
            'life.deletedTime': null
        });
        return media as IFile | null;
    }

    /**
     * Delete a media file.
     */
    async deleteMedia(
        id: string,
        requester: IUserWithoutToken
    ): Promise<{ success: boolean }> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN && requester.type !== enumUserTypes.STANDARD) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'User not authorized');
        }

        const result = await this.fileCore.deleteFile(requester.id, id);
        return { success: result.successful };
    }

    /**
     * Helper method to map MIME types to file types.
     */
    private getFileTypeFromMimeType(mimeType: string): enumFileTypes {
        switch (mimeType) {
            case 'image/jpeg':
            case 'image/jpg':
                return enumFileTypes.JPEG;
            case 'image/png':
                return enumFileTypes.PNG;
            case 'image/gif':
                return enumFileTypes.GIF;
            case 'image/webp':
                return enumFileTypes.WEBP;
            case 'video/mp4':
                return enumFileTypes.MP4;
            case 'video/avi':
                return enumFileTypes.AVI;
            case 'application/pdf':
                return enumFileTypes.PDF;
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return enumFileTypes.DOCX;
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                return enumFileTypes.XLSX;
            case 'application/vnd.ms-excel':
                return enumFileTypes.XLS;
            case 'text/plain':
                return enumFileTypes.TXT;
            case 'application/json':
                return enumFileTypes.JSON;
            default:
                return enumFileTypes.UNKNOWN;
        }
    }
}
