import { EmailHandler } from './email.js';
import { ApiHandler } from './api.js';

export default {
  // 处理 HTTP API 请求
  async fetch(request, env, ctx) {
    return new ApiHandler(env).handle(request);
  },

  // 处理邮件接收
  async email(message, env, ctx) {
    return new EmailHandler(env).handle(message);
  },

  // 处理定时任务 (Cron Triggers)
  async scheduled(event, env, ctx) {
    return new ApiHandler(env).scheduled(event);
  }
};
