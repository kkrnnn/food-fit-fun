import { handleAnalytics } from '../../server/analytics.js';
export default { fetch: (request: Request) => handleAnalytics(request, 'feedback') };
