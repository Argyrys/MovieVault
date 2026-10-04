import { env } from '../config/env.js';
import * as tmdbModule from './tmdb.js';
import * as simklModule from './simkl.js';

const active = env.metadataProvider === 'simkl' ? simklModule : tmdbModule;

export const tmdb = active.tmdb || active.metadata;
export const TmdbError = active.TmdbError;
export const imageUrl = active.imageUrl;
export const tmdbConfigured = active.tmdbConfigured;
export const clearTmdbCache = active.clearTmdbCache;
