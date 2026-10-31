import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
export const courses = pgTable('courses', {
  id: text().primaryKey(), title: text().notNull(), year: integer().notNull(), semester: text().notNull(),
});
export const resources = pgTable('resources', {
  id: text().primaryKey(), subjectId: text('subject_id').notNull().references(() => courses.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  category: text().notNull(), title: text().notNull(), filename: text().notNull(),
  format: text().notNull(), contentType: text('content_type').notNull(), size: integer().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
