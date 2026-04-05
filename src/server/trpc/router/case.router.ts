import { z } from "zod";
import { protectedProcedure, lawyerProcedure, clientProcedure, createTRPCContext, createTRPCRouter } from "../init";
import { TRPCError } from "@trpc/server";

export const caseRouter = createTRPCRouter({

})