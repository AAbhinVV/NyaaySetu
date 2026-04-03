import { lawyerRouter } from './routers/lawyer.router'
import { caseRouter } from './routers/case.router'
import { connectionRouter } from './routers/connection.router'
import { documentRouter } from './routers/document.router'
import { reviewRouter } from './routers/review.router'
import { notificationRouter } from './routers/notification.router'
import { adminRouter } from './routers/admin.router'
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