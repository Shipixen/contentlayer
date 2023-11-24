import type { DocumentGen } from 'shipixen-contentlayer/core'

export const urlFromFilePath = (doc: DocumentGen): string => doc._raw.flattenedPath.replace(/pages\/?/, '')
