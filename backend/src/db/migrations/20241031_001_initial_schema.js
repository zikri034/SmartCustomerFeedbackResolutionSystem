'use strict';

/**
 * Migration: Create tickets and emotion_logs tables
 */
exports.up = async function (knex) {
  // ── ENUM types ──────────────────────────────────────────────────────────────
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'escalated');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE dominant_emotion AS ENUM ('anger', 'disgust', 'fear', 'joy', 'sadness', 'neutral');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // ── tickets ─────────────────────────────────────────────────────────────────
  await knex.schema.createTable('tickets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('customer_name', 150).notNullable();
    t.string('customer_email', 255).notNullable();
    t.string('subject', 300).notNullable();
    t.text('body').notNullable();
    t.specificType('status', 'ticket_status').notNullable().defaultTo('open');
    t.specificType('priority', 'ticket_priority').notNullable().defaultTo('medium');
    t.boolean('auto_resolved').notNullable().defaultTo(false);
    t.text('resolution_text').nullable();
    t.timestamps(true, true);
  });

  // ── emotion_logs ─────────────────────────────────────────────────────────────
  await knex.schema.createTable('emotion_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    t.specificType('dominant_emotion', 'dominant_emotion').notNullable();
    t.float('anger_score').notNullable().defaultTo(0);
    t.float('disgust_score').notNullable().defaultTo(0);
    t.float('fear_score').notNullable().defaultTo(0);
    t.float('joy_score').notNullable().defaultTo(0);
    t.float('sadness_score').notNullable().defaultTo(0);
    t.jsonb('raw_watson_response').nullable();
    t.timestamps(true, true);
  });

  // ── Indexes ──────────────────────────────────────────────────────────────────
  await knex.schema.table('tickets', (t) => {
    t.index('status');
    t.index('priority');
    t.index('created_at');
    t.index('customer_email');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('emotion_logs');
  await knex.schema.dropTableIfExists('tickets');
  await knex.raw('DROP TYPE IF EXISTS dominant_emotion');
  await knex.raw('DROP TYPE IF EXISTS ticket_priority');
  await knex.raw('DROP TYPE IF EXISTS ticket_status');
};
