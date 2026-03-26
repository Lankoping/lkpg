import { createStartHandler } from '@tanstack/start/server'
import { router } from './router'

export const handler = createStartHandler({ router })
