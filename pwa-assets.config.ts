import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: {
        background: '#c9b3f5',
      },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: {
        background: '#c9b3f5',
      },
    },
  },
  images: ['public/icons/logo.svg'],
})
