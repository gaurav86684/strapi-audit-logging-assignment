export default {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/audit-logs',
      handler: 'audit-logs.find',
      config: {
        policies: ['admin::hasPermissions'],
        middlewares: ['admin::rateLimit'],
        auth: {
          scope: ['admin.audit-logs.read'],
        },
      },
    },
    {
      method: 'GET',
      path: '/audit-logs/:id',
      handler: 'audit-logs.findOne',
      config: {
        policies: ['admin::hasPermissions'],
        middlewares: ['admin::rateLimit'],
        auth: {
          scope: ['admin.audit-logs.read'],
        },
      },
    },
  ],
};
