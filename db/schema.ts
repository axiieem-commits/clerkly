import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable("cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  posting: text("posting").notNull(),
  presentation: text("presentation").notNull(),
  learning: text("learning").notNull(),
  tags: text("tags").notNull().default(""),
  status: text("status").notNull().default("To review"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});
