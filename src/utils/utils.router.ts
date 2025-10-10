// // src/audit/audit.router.ts
// import { Hono } from 'hono';
// import { auditController } from './utils.controller';
// import { adminAuth } from '../middleWare/bearAuth'; // IMPORTANT: Use your actual admin auth middleware

// export const auditRouter = new Hono();

// /**
//  * ==================================================================
//  *                       AUDIT & ARCHIVE ROUTES
//  * ==================================================================
//  *  IMPORTANT: All routes in this file should be protected by a
//  *  middleware that ensures only users with an 'admin' role can proceed.
//  * ==================================================================
//  */

// // Apply the admin authentication middleware to all routes in this file
// auditRouter.use('/*', adminAuth);

// /**
//  * @openapi
//  * /api/admin/audit-logs:
//  *   get:
//  *     summary: Get a filterable list of all audit log entries
//  *     description: Retrieves a paginated history of all CREATE, UPDATE, and DELETE actions performed in the system. Requires admin privileges.
//  *     tags:
//  *       - Audit
//  *     parameters:
//  *       - name: limit
//  *         in: query
//  *         description: Number of records to return
//  *         schema:
//  *           type: integer
//  *           default: 50
//  *       - name: offset
//  *         in: query
//  *         description: Number of records to skip for pagination
//  *         schema:
//  *           type: integer
//  *           default: 0
//  *       - name: actingUserId
//  *         in: query
//  *         description: Filter logs by the user ID who performed the action
//  *         schema:
//  *           type: integer
//  *       - name: tableName
//  *         in: query
//  *         description: Filter logs by the name of the table that was affected (e.g., 'caseTable', 'appointmentTable')
//  *         schema:
//  *           type: string
//  *       - name: recordPk
//  *         in: query
//  *         description: Filter logs by the primary key of the record that was affected
//  *         schema:
//  *           type: integer
//  *       - name: actionType
//  *         in: query
//  *         description: Filter logs by the type of action
//  *         schema:
//  *           type: string
//  *           enum: [CREATE, UPDATE, DELETE]
//  *       - name: dateFrom
//  *         in: query
//  *         description: Filter logs from this ISO 8601 date string
//  *         schema:
//  *           type: string
//  *           format: date-time
//  *       - name: dateTo
//  *         in: query
//  *         description: Filter logs up to this ISO 8601 date string
//  *         schema:
//  *           type: string
//  *           format: date-time
//  *     responses:
//  *       200:
//  *         description: A list of audit log entries.
//  *       400:
//  *         description: Invalid query parameters.
//  *       401:
//  *         description: Unauthorized.
//  *       403:
//  *         description: Forbidden. User is not an admin.
//  */
// auditRouter.get('/audit-logs', auditController.getAuditTrail);

// /**
//  * @openapi
//  * /api/admin/archived/{tableName}:
//  *   get:
//  *     summary: Get soft-deleted (archived) records from a specific table
//  *     description: Retrieves records that have been marked as deleted but are still present in the database. Requires admin privileges.
//  *     tags:
//  *       - Audit
//  *     parameters:
//  *       - name: tableName
//  *         in: path
//  *         required: true
//  *         description: The name of the table to retrieve archived records from.
//  *         schema:
//  *           type: string
//  *           enum: [userTable, caseTable, appointmentTable] # Add other archivable tables here
//  *       - name: limit
//  *         in: query
//  *         description: Number of records to return
//  *         schema:
//  *           type: integer
//  *           default: 20
//  *       - name: offset
//  *         in: query
//  *         description: Number of records to skip for pagination
//  *         schema:
//  *           type: integer
//  *           default: 0
//  *     responses:
//  *       200:
//  *         description: A list of archived records from the specified table.
//  *       400:
//  *         description: The specified table name is invalid or not archivable.
//  *       401:
//  *         description: Unauthorized.
//  *       403:
//  *         description: Forbidden. User is not an admin.
//  */
// auditRouter.get('/archived/:tableName', auditController.getArchived);