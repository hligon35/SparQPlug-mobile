import { Hono } from 'hono';
import { like, eq, or } from 'drizzle-orm';
import type { Bindings, Variables } from '../index';
import { createDb } from '../db';
import { contacts, companies, opportunities, stripeInvoices, documents, tasks } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

export const searchRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
searchRouter.use('*', authMiddleware);

searchRouter.get('/', async (c) => {
  const orgId = c.get('organizationId');
  const query = c.req.query('q') ?? '';
  if (!query || query.length < 2) {
    return c.json({ success: true, data: { query, results: [], grouped: {}, total: 0, took: 0 } });
  }

  const db = createDb(c.env.DB);
  const start = Date.now();
  const pattern = `%${query}%`;

  const [contactResults, companyResults, opportunityResults, documentResults, taskResults] = await Promise.all([
    db.query.contacts.findMany({ where: eq(contacts.organizationId, orgId), limit: 5, columns: { id: true, firstName: true, lastName: true, email: true, status: true } }),
    db.query.companies.findMany({ where: eq(companies.organizationId, orgId), limit: 5, columns: { id: true, name: true, industry: true, status: true } }),
    db.query.opportunities.findMany({ where: eq(opportunities.organizationId, orgId), limit: 5, columns: { id: true, name: true, stage: true, value: true } }),
    db.query.documents.findMany({ where: eq(documents.organizationId, orgId), limit: 5, columns: { id: true, name: true, mimeType: true, size: true } }),
    db.query.tasks.findMany({ where: eq(tasks.organizationId, orgId), limit: 5, columns: { id: true, title: true, status: true, priority: true } }),
  ]);

  const contactMapped = contactResults
    .filter(r => `${r.firstName} ${r.lastName}`.toLowerCase().includes(query.toLowerCase()) || r.email?.toLowerCase().includes(query.toLowerCase()))
    .map(r => ({ id: r.id, type: 'contact' as const, title: `${r.firstName} ${r.lastName}`, subtitle: r.email ?? undefined, url: `/crm/contacts/${r.id}` }));

  const companyMapped = companyResults
    .filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
    .map(r => ({ id: r.id, type: 'company' as const, title: r.name, subtitle: r.industry ?? undefined, url: `/crm/companies/${r.id}` }));

  const oppMapped = opportunityResults
    .filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
    .map(r => ({ id: r.id, type: 'opportunity' as const, title: r.name, subtitle: r.stage, url: `/crm/opportunities/${r.id}` }));

  const docMapped = documentResults
    .filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
    .map(r => ({ id: r.id, type: 'document' as const, title: r.name, subtitle: r.mimeType, url: `/documents/${r.id}` }));

  const taskMapped = taskResults
    .filter(r => r.title.toLowerCase().includes(query.toLowerCase()))
    .map(r => ({ id: r.id, type: 'task' as const, title: r.title, subtitle: r.status, url: `/tasks/${r.id}` }));

  const results = [...contactMapped, ...companyMapped, ...oppMapped, ...docMapped, ...taskMapped];

  return c.json({
    success: true,
    data: {
      query,
      results,
      grouped: { contacts: contactMapped, companies: companyMapped, opportunities: oppMapped, documents: docMapped, tasks: taskMapped },
      total: results.length,
      took: Date.now() - start,
    },
  });
});
