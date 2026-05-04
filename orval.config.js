/** @type {import('orval').defineConfig} */
module.exports = {
  networking: {
    input: {
      target: 'http://127.0.0.1:8000/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './packages/api/generated',
      schemas: './packages/api/model',
      client: 'react-query',
      httpClient: 'axios',
      clean: true,
      override: {
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
}