// // src/audit/audit.service.ts
// import db from "../drizzle/db";
// import { 
//     auditLogTable, 
//     userTable, 
//     caseTable, 
//     appointmentTable,
//     // ... import any other tables that have a `deleted_at` column
// } from "../drizzle/schema";
// import { eq, and, desc, gte, lte, isNotNull } from "drizzle-orm";
// import { z } from "zod";

// // --- Zod Schema for robust filtering of audit logs ---
// const auditLogFilterSchema = z.object({
//     limit: z.coerce.number().int().positive().optional().default(50),
//     offset: z.coerce.number().int().min(0).optional().default(0),
//     actingUserId: z.coerce.number().int().positive().optional(),
//     tableName: z.string().optional(),
//     recordPk: z.coerce.number().int().positive().optional(),
//     actionType: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
//     dateFrom: z.string().datetime().optional(),
//     dateTo: z.string().datetime().optional(),
// });

// // Define which tables are "archivable" (i.e., have a deleted_at column)
// export type ArchivableTable = 'userTable' | 'caseTable' | 'appointmentTable'; // Add other tables here

// export const auditService = {
//     /**
//      * Retrieves a paginated and filterable list of audit log entries.
//      * This allows administrators to see a full history of actions in the system.
//      * @param filters - The filtering and pagination options.
//      * @returns A list of audit log entries with the user who performed the action.
//      */
//     getAuditLogs: async (filters: z.infer<typeof auditLogFilterSchema>) => {
//         // Validate filters with Zod
//         const validatedFilters = auditLogFilterSchema.parse(filters);

//         const conditions = [];
//         if (validatedFilters.actingUserId) {
//             conditions.push(eq(auditLogTable.user_id, validatedFilters.actingUserId));
//         }
//         if (validatedFilters.tableName) {
//             conditions.push(eq(auditLogTable.table_name, validatedFilters.tableName));
//         }
//         if (validatedFilters.recordPk) {
//             conditions.push(eq(auditLogTable.record_pk, validatedFilters.recordPk));
//         }
//         if (validatedFilters.actionType) {
//             conditions.push(eq(auditLogTable.action_type, validatedFilters.actionType));
//         }
//         if (validatedFilters.dateFrom) {
//             conditions.push(gte(auditLogTable.action_timestamp, new Date(validatedFilters.dateFrom)));
//         }
//         if (validatedFilters.dateTo) {
//             conditions.push(lte(auditLogTable.action_timestamp, new Date(validatedFilters.dateTo)));
//         }

//         const finalConditions = conditions.length > 0 ? and(...conditions) : undefined;

//         // Query the audit log table and join with the user table to get the user's name
//         const logs = await db.query.auditLogTable.findMany({
//             where: finalConditions,
//             orderBy: [desc(auditLogTable.action_timestamp)],
//             limit: validatedFilters.limit,
//             offset: validatedFilters.offset,
//             with: {
//                 user: {
//                     columns: {
//                         full_name: true,
//                         email: true
//                     }
//                 }
//             }
//         });

//         return logs;
//     },

//     /**
//      * Retrieves "archived" (soft-deleted) records from a specified table.
//      * This is used to view data that has been deleted by users but is still in the database.
//      * @param tableName The name of the table to query for archived data.
//      * @param limit The number of records to return.
//      * @param offset The number of records to skip for pagination.
//      * @returns A list of soft-deleted records.
//      */
//     getArchivedRecords: async (
//         tableName: ArchivableTable,
//         limit: number = 20,
//         offset: number = 0
//     ) => {
//         const queryOptions = {
//             where: isNotNull(
//                 // This dynamic access requires a mapping or switch
//                 tableName === 'userTable' ? userTable.deleted_at :
//                 tableName === 'caseTable' ? caseTable.deleted_at :
//                 appointmentTable.deleted_at // Default for appointmentTable
//             ),
//             limit,
//             offset,
//             orderBy: [
//                 desc(
//                     tableName === 'userTable' ? userTable.deleted_at :
//                     tableName === 'caseTable' ? caseTable.deleted_at :
//                     appointmentTable.deleted_at
//                 )
//             ]
//         };

//         // Use a switch to query the correct, strongly-typed Drizzle table object
//         switch (tableName) {
//             case 'userTable':
//                 return await db.query.userTable.findMany(queryOptions);
//             case 'caseTable':
//                 return await db.query.caseTable.findMany(queryOptions);
//             case 'appointmentTable':
//                 return await db.query.appointmentTable.findMany(queryOptions);
//             default:
//                 // This prevents querying a non-archivable table
//                 throw new Error(`Table '${tableName}' is not configured for archiving.`);
//         }
//     },
// };