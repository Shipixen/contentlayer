import { config, page } from '@sourcebit/sdk/types'
import React, { FC } from 'react'
import { Layout } from '../components/index'
import { htmlToReact, markdownify, withPrefix } from '../utils'

const Page: FC<{
  doc: page
  config: config
}> = ({ config, doc }) => {
  return (
    <Layout doc={doc} config={config}>
      <div className="outer">
        <div className="inner-medium">
          <article className="post post-full">
            <header className="post-header">
              <h1 className="post-title">{doc.title}</h1>
              {doc.subtitle && <div className="post-subtitle">{htmlToReact(doc.subtitle)}</div>}
            </header>
            {doc.image && (
              <div className="post-image">
                <img src={withPrefix(doc.image)} alt={doc.image_alt} />
              </div>
            )}
            {/* TODO type properly */}
            <div className="post-content">{markdownify((doc as any).__content)}</div>
          </article>
        </div>
      </div>
    </Layout>
  )
}

export default Page