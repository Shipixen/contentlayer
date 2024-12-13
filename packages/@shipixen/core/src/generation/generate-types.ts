import { casesHandled, pattern } from '@shipixen/utils'

import type { SourcePluginType } from '../plugin.js'
import type { DocumentTypeDef, FieldDef, ListFieldDefItem, NestedTypeDef, SchemaDef } from '../schema/index.js'
import { autogeneratedNote, getDataVariableName } from './common.js'
import type { GenerationOptions } from './generate-dotpkg.js'

export const renderTypes = ({
  schemaDef,
  generationOptions,
}: {
  schemaDef: SchemaDef
  generationOptions: GenerationOptions
}): string => {
  const documentTypes = Object.values(schemaDef.documentTypeDefMap)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((def) => ({
      typeName: def.name,
      typeDef: renderDocumentTypeDefOrNestedTypeDef({ def, generationOptions }),
    }))

  const nestedTypes = Object.values(schemaDef.nestedTypeDefMap)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((def) => ({
      typeName: def.name,
      typeDef: renderDocumentTypeDefOrNestedTypeDef({ def, generationOptions }),
    }))

  // TODO this might be no longer needed and can be removed once `isType` has been refactored
  // to not depend on global types
  const documentTypeMap = documentTypes
    .map(prop('typeName'))
    .map((_) => `  ${_}: ${_}`)
    .join('\n')

  const nestedTypeMap = nestedTypes
    .map(prop('typeName'))
    .map((_) => `  ${_}: ${_}`)
    .join('\n')

  const importsForRawTypes = pattern
    .match(generationOptions.sourcePluginType)
    .with('local', () => `import * as Local from 'shipixen-contentlayer/source-files'`)
    .with('contentful', () => `import * as Contentful from '@shipixen/source-contentful'`)
    .otherwise(() => ``)

  const documentTypeNames = documentTypes.map(prop('typeName'))
  const nestedTypeNames = nestedTypes.map(prop('typeName'))

  const dataExportsStr = Object.values(schemaDef.documentTypeDefMap)
    .map((docDef) => {
      const dataVariableName = getDataVariableName({ docDef })

      if (docDef.isSingleton) {
        return `${dataVariableName}: ${docDef.name}`
      } else {
        return `${dataVariableName}: ${docDef.name}[]`
      }
    })
    .map(indent(2))
    .join('\n')

  return `\
// ${autogeneratedNote}

import type { Markdown, MDX, ImageFieldData, IsoDateTimeString } from 'shipixen-contentlayer/core'
${importsForRawTypes}

export { isType } from 'shipixen-contentlayer/client'

export type { Markdown, MDX, ImageFieldData, IsoDateTimeString }

/** Document types */
${documentTypes.map(prop('typeDef')).join('\n\n')}

/** Nested types */
${nestedTypes.map(prop('typeDef')).join('\n\n')}

/** Helper types */

export type AllTypes = DocumentTypes | NestedTypes
export type AllTypeNames = DocumentTypeNames | NestedTypeNames

export type DocumentTypes = ${renderUnion(documentTypeNames)}
export type DocumentTypeNames = ${renderUnion(documentTypeNames.map(wrapInQuotes))}

export type NestedTypes = ${nestedTypes.length > 0 ? renderUnion(nestedTypeNames) : 'never'}
export type NestedTypeNames = ${nestedTypes.length > 0 ? renderUnion(nestedTypeNames.map(wrapInQuotes)) : 'never'}

export type DataExports = {
  allDocuments: DocumentTypes[]
${dataExportsStr}
}


export interface ContentlayerGenTypes {
  documentTypes: DocumentTypes
  documentTypeMap: DocumentTypeMap
  documentTypeNames: DocumentTypeNames
  nestedTypes: NestedTypes
  nestedTypeMap: NestedTypeMap
  nestedTypeNames: NestedTypeNames
  allTypeNames: AllTypeNames
  dataExports: DataExports
}

declare global {
  interface ContentlayerGen extends ContentlayerGenTypes {}
}

export type DocumentTypeMap = {
${documentTypeMap}
}

export type NestedTypeMap = {
${nestedTypeMap}
}

 `
}

export const renderDocumentTypeDefOrNestedTypeDef = ({
  def,
  generationOptions: { options, sourcePluginType },
}: {
  def: DocumentTypeDef | NestedTypeDef
  // sourcePluginType: SourcePluginType | 'unknown'
  generationOptions: GenerationOptions
}): string => {
  const typeName = def.name
  const typeNameField = options.fieldOptions.typeFieldName
  const fieldDefs = def.fieldDefs
    // ignore "type field" to avoid duplicate rendering
    .filter((_) => _.name !== typeNameField)
    .map(renderFieldDef)
    .join('\n')
  const computedFields = (def._tag === 'DocumentTypeDef' ? def.computedFields : [])
    .map((field) => `${field.description ? `  /** ${field.description} */\n` : ''}  ${field.name}: ${field.type}`)
    .join('\n')
  const description = def.description ?? def.extensions.stackbit?.fields?.[def.name]?.label

  const rawType = renderRawType({ sourcePluginType })
  const idJsdoc = renderIdJsdoc({ sourcePluginType })

  return `\
${description ? `/** ${description} */\n` : ''}export type ${typeName} = {
  /** ${idJsdoc} */
  _id: string
  _raw: ${rawType}
  ${typeNameField}: '${typeName}'
${fieldDefs}
${computedFields}
}`
}

const renderIdJsdoc = ({ sourcePluginType }: { sourcePluginType: SourcePluginType }) => {
  switch (sourcePluginType) {
    case 'local':
      return 'File path relative to `contentDirPath`'
    case 'contentful':
      return 'Contentful object id'
    case 'sanity':
      return 'Sanity object id'
    default:
      return 'ID'
  }
}

const renderRawType = ({ sourcePluginType }: { sourcePluginType: SourcePluginType }) => {
  switch (sourcePluginType) {
    case 'local':
      return `Local.RawDocumentData`
    case 'contentful':
      return `Contentful.RawDocumentData`
    case 'sanity':
      return 'Record<string, any>'
    default:
      return 'Record<string, any>'
  }
}

const renderFieldDef = (field: FieldDef): string => {
  const canBeUndefined = field.isRequired === false && field.default === undefined
  return `${field.description ? `  /** ${field.description} */\n` : ''}  ${field.name}${
    canBeUndefined ? '?' : ''
  }: ${renderFieldType(field)}${canBeUndefined ? ' | undefined' : ''}`
}

const renderFieldType = (field: FieldDef): string => {
  switch (field.type) {
    case 'boolean':
    case 'string':
    case 'number':
      return field.type
    case 'json':
      return 'any'
    case 'date':
      return 'IsoDateTimeString'
    // TODO but requires schema knowledge in the client
    // return 'Date'
    case 'markdown':
      return 'Markdown'
    case 'mdx':
      return 'MDX'
    case 'image':
      return 'ImageFieldData'
    case 'nested':
      return field.nestedTypeName
    case 'nested_polymorphic':
      return renderUnion(field.nestedTypeNames)
    case 'nested_unnamed':
      return '{\n' + field.typeDef.fieldDefs.map(renderFieldDef).map(indent(2)).join('\n') + '\n  }'
    case 'reference':
      if (field.embedDocument) {
        return field.documentTypeName
      }
      return 'string'
    case 'reference_polymorphic':
      return 'string'
    case 'list_polymorphic':
      return renderPolymorphicListType(field.of.map(renderListItemFieldType))
    case 'list':
      return renderListItemFieldType(field.of) + '[]'
    case 'enum':
      return renderUnion(field.options.map(wrapInQuotes))
    default:
      casesHandled(field)
  }
}

const renderUnion = (typeNames: readonly string[]): string => typeNames.join(' | ')

const renderPolymorphicListType = (typeNames: string[]): string => wrapInParenthesis(renderUnion(typeNames)) + '[]'

const indent = (spaceCount: number) => (str: string) => `${' '.repeat(spaceCount)}${str}`

const wrapInParenthesis = (_: string) => `(${_})`
const wrapInQuotes = (_: string) => `'${_}'`
const prop =
  <T extends {}, K extends keyof T>(key: K) =>
  (obj: T): T[K] =>
    obj[key]

const renderListItemFieldType = (item: ListFieldDefItem.Item): string => {
  switch (item.type) {
    case 'boolean':
    case 'string':
    case 'number':
      return item.type
    case 'json':
      return 'any'
    case 'date':
      return 'string'
    case 'markdown':
      return 'Markdown'
    case 'mdx':
      return 'MDX'
    case 'image':
      return 'ImageFieldData'
    case 'nested':
      return item.nestedTypeName
    case 'enum':
      return wrapInParenthesis(renderUnion(item.options.map(wrapInQuotes)))
    case 'nested_unnamed':
      return '{\n' + item.typeDef.fieldDefs.map(renderFieldDef).join('\n') + '\n}'
    case 'reference':
      if (item.embedDocument) {
        return item.documentTypeName
      }
      // We're just returning the id (e.g. file path or record id) to the referenced document here
      return 'string'
    default:
      casesHandled(item)
  }
}