import appHTML from '../../dist/client/index.html';
import { handleSiteRequest } from './router.js';
export default { fetch(request, env) { return handleSiteRequest(request, env, { html: appHTML }); } };
