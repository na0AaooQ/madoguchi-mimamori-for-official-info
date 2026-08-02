import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

const markdownRecommendedRules = markdown.configs.recommended[0].rules;

export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      '.nyc_output/**',
      'dist/**',
      'tmp/**',
      'temp/**',
      'package-lock.json'
    ]
  },
  {
    files: ['*.js', 'scripts/**/*.js', 'tests/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.nodeBuiltin
    }
  },
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
    rules: json.configs.recommended.rules
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    rules: markdownRecommendedRules
  },
  ...markdown.configs.processor,
  {
    files: ['**/*.md/*.js', '**/*.md/*.javascript'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.nodeBuiltin
    }
  },
  prettierConfig
];
