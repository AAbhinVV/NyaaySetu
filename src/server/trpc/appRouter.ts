import { lawyerRouter } from './router/lawyer.router'
import { caseRouter } from './router/case.router'
import { connectionRouter } from './router/connection.router'
import { documentRouter } from './router/document.router'
import { reviewRouter } from './router/review.router'
import { notificationRouter } from './router/notification.router'
import { adminRouter } from './router/admin.router'
import { createTRPCRouter } from './init'

export const appRouter = createTRPCRouter({
    lawyer: lawyerRouter,
    case: caseRouter,
    connection: connectionRouter,
    document: documentRouter,
    review: reviewRouter,
    notification: notificationRouter,
    admin: adminRouter,
})

export type AppRouter = typeof appRouter