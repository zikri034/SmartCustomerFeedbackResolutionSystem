'use strict';

const knexfile = require('./knexfile');
const knex = require('knex');

const env = process.env.NODE_ENV || 'development';
const db = knex(knexfile[env]);

module.exports = db;
