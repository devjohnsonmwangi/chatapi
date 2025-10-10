// // src/audit/audit.controller.ts
// import { Context } from 'hono';
// import { auditService, ArchivableTable } from './utils.service';

// export const auditController = {
//     // Example: GET /api/admin/audit-logs?tableName=appointmentTable&actingUserId=5
//     getAuditTrail: async (c: Context) => {
//         try {
//             const queryParams = c.req.query();
//             // Parse and construct the expected parameter object
//             const limit = queryParams.limit ? parseInt(queryParams.limit) : undefined;
//             const offset = queryParams.offset ? parseInt(queryParams.offset) : undefined;
//             const actingUserId = queryParams.actingUserId ? parseInt(queryParams.actingUserId) : undefined;
//             const tableName = queryParams.tableName;
//             const recordPk = queryParams.recordPk ? parseInt(queryParams.recordPk) : undefined;
//             const actionType = queryParams.actionType as "CREATE" | "UPDATE" | "DELETE" | undefined;
//             const dateFrom = queryParams.dateFrom;
//             const dateTo = queryParams.dateTo;

//             const params: {
//                 limit: number;
//                 offset: number;
//                 actingUserId?: number;
//                 tableName?: string;
//                 recordPk?: number;
//                 actionType?: "CREATE" | "UPDATE" | "DELETE";
//                 dateFrom?: string;
//                 dateTo?: string;
//             } = {
//                 limit: limit as number,
//                 offset: offset as number,
//             };

//             if (actingUserId !== undefined) params.actingUserId = actingUserId;
//             if (tableName !== undefined) params.tableName = tableName;
//             if (recordPk !== undefined) params.recordPk = recordPk;
//             if (actionType !== undefined) params.actionType = actionType;
//             if (dateFrom !== undefined) params.dateFrom = dateFrom;
//             if (dateTo !== undefined) params.dateTo = dateTo;

//             const logs = await auditService.getAuditLogs(params);
//             return c.json(logs);
//         } catch (error: any) {
//             return c.json({ error: error?.issues || error.message || 'Failed to fetch audit logs' }, 400);
//         }
//     },

//     // Example: GET /api/admin/archived/caseTable
//     getArchived: async (c: Context) => {
//         try {
//             const tableName = c.req.param('tableName') as ArchivableTable;
//             const { limit, offset } = c.req.query();

//             // Basic validation
//             const validTables: ArchivableTable[] = ['userTable', 'caseTable', 'appointmentTable'];
//             if (!validTables.includes(tableName)) {
//                 return c.json({ error: 'Invalid or non-archivable table specified' }, 400);
//             }

//             const parsedLimit = limit ? parseInt(limit) : undefined;
//             const parsedOffset = offset ? parseInt(offset) : undefined;
            
//             const records = await auditService.getArchivedRecords(tableName, parsedLimit, parsedOffset);
//             return c.json(records);
//         } catch (error: any) {
//             return c.json({ error: error.message || 'Failed to fetch archived records' }, 500);
//         }
//     },
// };