import { getRouter } from './router'
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

export default createStartHandler({
  createRouter: getRouter,
})(defaultStreamHandler)
