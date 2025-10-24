import { z } from 'zod';
import { FileUploadSchema, enumPageStatus } from '@itmat-broker/itmat-types';
import { PageCore } from '@itmat-broker/itmat-cores';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';

export class PageRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    pageCore: PageCore;

    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, pageCore: PageCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.pageCore = pageCore;
    }


    _router() {
        return this.router({
            // Page endpoints
            getPages: this.baseProcedure.input(z.object({
                limit: z.number().optional(),
                page: z.number().optional(),
                adminView: z.boolean().optional(),
                searchTerm: z.string().optional()
            })).query(async ({ input, ctx }) => {
                return await this.pageCore.getPages(input.limit, input.page, ctx.req?.user ?? ctx.user, input.adminView, input.searchTerm);
            }),

            getPageById: this.baseProcedure.input(z.object({
                id: z.string()
            })).query(async ({ input, ctx }) => {
                return await this.pageCore.getPageById(input.id, ctx.req?.user ?? ctx.user);
            }),

            createPage: this.baseProcedure.input(z.object({
                title: z.string(),
                slug: z.string(),
                status: z.nativeEnum(enumPageStatus),
                content: z.array(z.any())
            })).mutation(async ({ input, ctx }) => {
                return await this.pageCore.createPage(input, ctx.req?.user ?? ctx.user);
            }),

            updatePage: this.baseProcedure.input(z.object({
                id: z.string(),
                title: z.string().optional(),
                slug: z.string().optional(),
                status: z.nativeEnum(enumPageStatus).optional(),
                content: z.array(z.any()).optional()
            })).mutation(async ({ input, ctx }) => {
                const { id, ...data } = input;
                return await this.pageCore.updatePage(id, data, ctx.req?.user ?? ctx.user);
            }),

            deletePage: this.baseProcedure.input(z.object({
                id: z.string()
            })).mutation(async ({ input, ctx }) => {
                return await this.pageCore.deletePage(input.id, ctx.req?.user ?? ctx.user);
            }),

            // Media endpoints
            getMedia: this.baseProcedure.input(z.object({
                limit: z.number().optional(),
                page: z.number().optional(),
                adminView: z.boolean().optional()
            })).query(async ({ input, ctx }) => {
                return await this.pageCore.getMedia(input.limit, input.page, ctx.req?.user ?? ctx.user, input.adminView);
            }),

            createMedia: this.baseProcedure.input(z.object({
                files: z.object({
                    file: z.array(FileUploadSchema)
                }).optional(),
                alt: z.string().optional()
            })).mutation(async ({ input, ctx }) => {
                const files = input.files || ((ctx.req as Record<string, unknown>)['body'] as Record<string, unknown>)?.['files'];
                const file = (files as Record<string, unknown>)?.['file']?.[0];
                const altText = input.alt || ((ctx.req as Record<string, unknown>)['body'] as Record<string, unknown>)?.['alt'] || (file as Record<string, unknown>)?.['filename'];

                return await this.pageCore.uploadMediaFile(ctx.req?.user ?? ctx.user, file, altText as string | undefined);
            }),

            deleteMedia: this.baseProcedure.input(z.object({
                id: z.string()
            })).mutation(async ({ input, ctx }) => {
                return await this.pageCore.deleteMedia(input.id, ctx.req?.user ?? ctx.user);
            }),

            getMediaByFilename: this.baseProcedure.input(z.object({
                filename: z.string()
            })).query(async ({ input }) => {
                return await this.pageCore.getMediaByFilename(input.filename);
            }),

            getMediaById: this.baseProcedure.input(z.object({
                id: z.string()
            })).query(async ({ input }) => {
                return await this.pageCore.getMediaById(input.id);
            })
        });
    }
}
