/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { MongoMemoryServer } from 'mongodb-memory-server';
import { db } from '../../src/database/database';
import { Express } from 'express';
import { objStore } from '../../src/objStore/objStore';
import request from 'supertest';
import { connectAdmin, connectUser } from './_loginHelper';
import { Router } from '../../src/server/router';
import { Db, MongoClient } from 'mongodb';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import { enumUserTypes, enumFileCategories, enumFileTypes, enumPageStatus } from '@itmat-broker/itmat-types';
import { encodeQueryParams } from './helper';

if (global.hasMinio) {
    let app: Express;
    let mongodb: MongoMemoryServer;
    let admin: request.SuperTest<request.Test>;
    let user: request.SuperTest<request.Test>;
    let mongoConnection: MongoClient;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mongoClient: Db;
    let adminProfile;
    let userProfile;


    afterAll(async () => {
        await db.closeConnection();
        await mongoConnection?.close();
        await mongodb.stop();

        /* claer all mocks */
        jest.clearAllMocks();
    });

    beforeAll(async () => { // eslint-disable-line no-undef
        /* Creating a in-memory MongoDB instance for testing */
        const dbName = uuid();
        mongodb = await MongoMemoryServer.create({ instance: { dbName } });
        const connectionString = mongodb.getUri();
        await setupDatabase(connectionString, dbName);

        /* Wiring up the backend server */
        config.objectStore.port = (global as any).minioContainerPort;
        config.database.mongo_url = connectionString;
        config.database.database = dbName;
        await db.connect(config.database, MongoClient);
        await objStore.connect(config.objectStore);
        const router = new Router(config);
        await router.init();

        /* Connect mongo client (for test setup later / retrieve info later) */
        mongoConnection = await MongoClient.connect(connectionString);
        mongoClient = mongoConnection.db(dbName);

        /* Connecting clients for testing later */
        app = router.getApp();
        admin = request.agent(app);
        user = request.agent(app);
        await connectAdmin(admin);
        await connectUser(user);

        // add the root node for each user
        const users = await db.collections.users_collection.find({}).toArray();
        adminProfile = users.filter(el => el.type === enumUserTypes.ADMIN)[0];
        userProfile = users.filter(el => el.type === enumUserTypes.STANDARD)[0];
    });

    describe('tRPC page APIs', () => {
        afterEach(async () => {
            await db.collections.page_collection.deleteMany({});
            await db.collections.files_collection.deleteMany({});
        });

        test('Create page (admin)', async () => {
            const parameters = {
                title: 'Test Page',
                slug: 'test-page',
                status: enumPageStatus.DRAFT,
                content: [{ id: '1', type: 'text', data: { text: 'Hello World' } }]
            };
            const response = await admin.post('/trpc/page.createPage')
                .send(parameters);

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data).toBeDefined();
            expect(response.body.result.data.title).toBe(parameters.title);
            expect(response.body.result.data.slug).toBe(parameters.slug);
            expect(response.body.result.data.createdBy).toBe(adminProfile.id);
        });

        test('Create page (standard user)', async () => {
            const parameters = {
                title: 'User Page',
                slug: 'user-page',
                status: 'published',
                content: [{ id: '1', type: 'text', data: { text: 'User content' } }]
            };
            const response = await user.post('/trpc/page.createPage')
                .send(parameters);

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.createdBy).toBe(userProfile.id);
        });

        test('Get pages (admin view)', async () => {
            // Create a test page first
            await mongoClient.collection(config.database.collections.page_collection).insertOne({
                id: uuid(),
                title: 'Admin Test Page',
                slug: 'admin-test-page',
                status: enumPageStatus.DRAFT,
                content: [{ id: '1', type: 'text', data: { text: 'Admin content' } }],
                createdBy: adminProfile.id,
                createdByUsername: adminProfile.username,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            const parameters = {
                limit: 50,
                adminView: true
            };
            const response = await admin.get('/trpc/page.getPages?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.docs).toBeDefined();
            expect(response.body.result.data.docs.length).toBeGreaterThanOrEqual(1);
        });

        test('Get pages (public view)', async () => {
            // Create a published page
            await mongoClient.collection(config.database.collections.page_collection).insertOne({
                id: uuid(),
                title: 'Public Test Page',
                slug: 'public-test-page',
                status: 'published',
                content: [{ id: '1', type: 'text', data: { text: 'Public content' } }],
                createdBy: adminProfile.id,
                createdByUsername: adminProfile.username,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            const parameters = {
                limit: 50
            };
            const response = await admin.get('/trpc/page.getPages?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.docs).toBeDefined();
            // Should only show published pages
            const publishedPages = response.body.result.data.docs.filter(
                (page: any) => page.status === 'published'
            );
            expect(publishedPages.length).toBe(response.body.result.data.docs.length);
        });

        test('Search pages by title', async () => {
            // Create test pages
            await mongoClient.collection(config.database.collections.page_collection).insertMany([
                {
                    id: uuid(),
                    title: 'JavaScript Tutorial',
                    slug: 'javascript-tutorial',
                    status: 'published',
                    content: [{ id: '1', type: 'text', data: { text: 'Learn JavaScript' } }],
                    createdBy: adminProfile.id,
                    createdByUsername: adminProfile.username,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: uuid(),
                    title: 'React Guide',
                    slug: 'react-guide',
                    status: 'published',
                    content: [{ id: '1', type: 'text', data: { text: 'Learn React' } }],
                    createdBy: adminProfile.id,
                    createdByUsername: adminProfile.username,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]);

            const parameters = {
                limit: 50,
                searchTerm: 'JavaScript'
            };
            const response = await admin.get('/trpc/page.getPages?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.docs).toBeDefined();
            // Should find the JavaScript tutorial page
            const foundPages = response.body.result.data.docs.filter(
                (page: any) => page.title.toLowerCase().includes('javascript')
            );
            expect(foundPages.length).toBeGreaterThan(0);
        });

        test('Get page by ID', async () => {
            // Create a test page
            const pageId = uuid();
            await mongoClient.collection(config.database.collections.page_collection).insertOne({
                id: pageId,
                title: 'Test Page by ID',
                slug: 'test-page-by-id',
                status: 'published',
                content: [{ id: '1', type: 'text', data: { text: 'Test content' } }],
                createdBy: adminProfile.id,
                createdByUsername: adminProfile.username,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            const parameters = {
                id: pageId
            };
            const response = await admin.get('/trpc/page.getPageById?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.id).toBe(pageId);
            expect(response.body.result.data.title).toBe('Test Page by ID');
        });

        test('Update page', async () => {
            // Create a test page first
            const pageId = uuid();
            await mongoClient.collection(config.database.collections.page_collection).insertOne({
                id: pageId,
                title: 'Original Title',
                slug: 'original-slug',
                status: enumPageStatus.DRAFT,
                content: [{ id: '1', type: 'text', data: { text: 'Original content' } }],
                createdBy: adminProfile.id,
                createdByUsername: adminProfile.username,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            const parameters = {
                id: pageId,
                title: 'Updated Title',
                status: 'published'
            };
            const response = await admin.post('/trpc/page.updatePage')
                .send(parameters);

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.title).toBe('Updated Title');
            expect(response.body.result.data.status).toBe('published');
        });

        test('Delete page', async () => {
            // Create a test page first
            const pageId = uuid();
            await mongoClient.collection(config.database.collections.page_collection).insertOne({
                id: pageId,
                title: 'Page to Delete',
                slug: 'page-to-delete',
                status: enumPageStatus.DRAFT,
                content: [{ id: '1', type: 'text', data: { text: 'Delete me' } }],
                createdBy: adminProfile.id,
                createdByUsername: adminProfile.username,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            const parameters = {
                id: pageId
            };
            const response = await admin.post('/trpc/page.deletePage')
                .send(parameters);

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.success).toBe(true);
        });

        test('Get media (admin view)', async () => {
            const parameters = {
                limit: 50,
                adminView: true
            };
            const response = await admin.get('/trpc/page.getMedia?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.docs).toBeDefined();
            expect(response.body.result.data.totalDocs).toBeDefined();
        });

        test('Get media (public view)', async () => {
            const parameters = {
                limit: 50
            };
            const response = await admin.get('/trpc/page.getMedia?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.docs).toBeDefined();
        });

        test('Unauthenticated user cannot access admin endpoints', async () => {
            const unauthenticated = request.agent(app);

            const parameters = {
                limit: 50,
                adminView: true
            };
            const response = await unauthenticated.get('/trpc/page.getPages?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('NOT_LOGGED_IN');
        });

        test('Unauthenticated user cannot access public endpoints', async () => {
            const unauthenticated = request.agent(app);

            const parameters = {
                limit: 50
            };
            const response = await unauthenticated.get('/trpc/page.getPages?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('NOT_LOGGED_IN');
        });



        test('Standard user can only see their own pages in admin view', async () => {
            // Create pages by admin and user
            await mongoClient.collection(config.database.collections.page_collection).insertMany([
                {
                    id: uuid(),
                    title: 'Admin Page',
                    slug: 'admin-page',
                    status: enumPageStatus.DRAFT,
                    content: [{ id: '1', type: 'text', data: { text: 'Admin content' } }],
                    createdBy: adminProfile.id,
                    createdByUsername: adminProfile.username,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: uuid(),
                    title: 'User Page',
                    slug: 'user-page',
                    status: enumPageStatus.DRAFT,
                    content: [{ id: '1', type: 'text', data: { text: 'User content' } }],
                    createdBy: userProfile.id,
                    createdByUsername: userProfile.username,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]);

            const parameters = {
                limit: 50,
                adminView: true
            };
            const response = await user.get('/trpc/page.getPages?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.docs).toBeDefined();
            // Should only see pages created by this user
            const userPages = response.body.result.data.docs.filter(
                (page: any) => page.createdBy === userProfile.id
            );
            expect(userPages.length).toBe(response.body.result.data.docs.length);
        });

        test('Get media by filename', async () => {
            // Create a media file
            const mediaData = {
                id: uuid(),
                fileName: 'test-image.jpg',
                fileCategory: enumFileCategories.PAGE_MEDIA_FILE,
                fileType: enumFileTypes.JPEG,
                fileSize: '1024',
                uri: '/media/test-image.jpg',
                hash: 'test-hash',
                description: 'Test image',
                uploadTime: new Date().toISOString(),
                uploadedBy: adminProfile.id,
                life: {
                    createdTime: Date.now(),
                    createdUser: adminProfile.id,
                    deletedTime: null,
                    deletedUser: null
                }
            };
            await mongoClient.collection(config.database.collections.files_collection).insertOne(mediaData);

            const parameters = {
                filename: 'test-image.jpg'
            };
            const response = await admin.get('/trpc/page.getMediaByFilename?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.fileName).toBe('test-image.jpg');
        });

        test('Get media by ID', async () => {
            // Create a media file
            const mediaId = uuid();
            const mediaData = {
                id: mediaId,
                fileName: 'test-image.jpg',
                fileCategory: enumFileCategories.PAGE_MEDIA_FILE,
                fileType: enumFileTypes.JPEG,
                fileSize: '1024',
                uri: '/media/test-image.jpg',
                hash: 'test-hash',
                description: 'Test image',
                uploadTime: new Date().toISOString(),
                uploadedBy: adminProfile.id,
                life: {
                    createdTime: Date.now(),
                    createdUser: adminProfile.id,
                    deletedTime: null,
                    deletedUser: null
                }
            };
            await mongoClient.collection(config.database.collections.files_collection).insertOne(mediaData);

            const parameters = {
                id: mediaId
            };
            const response = await admin.get('/trpc/page.getMediaById?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.id).toBe(mediaId);
        });

        test('Delete media', async () => {
            // Create a media file first
            const mediaId = uuid();
            const mediaData = {
                id: mediaId,
                fileName: 'test-image.jpg',
                fileCategory: enumFileCategories.PAGE_MEDIA_FILE,
                fileType: enumFileTypes.JPEG,
                fileSize: '1024',
                uri: '/media/test-image.jpg',
                hash: 'test-hash',
                description: 'Test image',
                uploadTime: new Date().toISOString(),
                uploadedBy: adminProfile.id,
                life: {
                    createdTime: Date.now(),
                    createdUser: adminProfile.id,
                    deletedTime: null,
                    deletedUser: null
                }
            };
            await mongoClient.collection(config.database.collections.files_collection).insertOne(mediaData);

            const parameters = {
                id: mediaId
            };
            const response = await admin.post('/trpc/page.deleteMedia')
                .send(parameters);

            expect(response.status).toBe(200);
            expect(response.body.errors).toBeUndefined();
            expect(response.body.result.data.success).toBe(true);
        });

        test('Input validation - missing required fields', async () => {
            const parameters = {
                // Missing title, slug, status, content
            };
            const response = await admin.post('/trpc/page.createPage')
                .send(parameters);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        test('Input validation - invalid status', async () => {
            const parameters = {
                title: 'Test Page',
                slug: 'test-page',
                status: 'invalid-status',
                content: [{ id: '1', type: 'text', data: { text: 'Test' } }]
            };
            const response = await admin.post('/trpc/page.createPage')
                .send(parameters);

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });

        test('Error case - non-existent page', async () => {
            const parameters = {
                id: 'non-existent-id'
            };
            const response = await admin.post('/trpc/page.deletePage')
                .send(parameters);

            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('not found or access denied');
        });

        test('Error case - unauthorized access to admin endpoint', async () => {
            const unauthenticated = request.agent(app);

            const parameters = {
                limit: 50,
                adminView: true
            };
            const response = await unauthenticated.get('/trpc/page.getPages?input=' + encodeQueryParams(parameters))
                .query({});

            expect(response.status).toBe(400);
            expect(response.body.error.message).toContain('NOT_LOGGED_IN');
        });
    });
} else {
    describe('Page Management Tests', () => {
        test('Skipped - MinIO not available', () => {
            expect(true).toBe(true);
        });
    });
}