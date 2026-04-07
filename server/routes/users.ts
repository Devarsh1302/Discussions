import { Router, type Request, type Response } from "express";
import type { BootstrapUserRequest, BootstrapUserResponse } from "../../shared/types";
import { DiscussionService } from "../services/discussionService";

export function createUsersRouter(service: DiscussionService) {
  const router = Router();

  router.post(
    "/bootstrap",
    async (
      request: Request<unknown, BootstrapUserResponse, BootstrapUserRequest>,
      response: Response<BootstrapUserResponse>,
      next
    ) => {
      try {
        const user = await service.bootstrapUser(request.body?.input?.deviceKey);
        response.json({ user });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
