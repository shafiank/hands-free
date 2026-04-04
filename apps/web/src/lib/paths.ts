import path from 'path';
import os from 'os';
export const DATA_DIR      = process.env.HANDSFREE_DATA_DIR || path.join(os.homedir(), '.handsfree-data');
export const WORKSPACE_DIR = path.join(DATA_DIR, 'workspace');
export const SKILLS_DIR    = path.join(DATA_DIR, 'skills');
export const SKILLS_MANIFEST = path.join(SKILLS_DIR, 'manifest.json');