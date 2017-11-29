import { Component, EditorSession, DefaultDOMElement } from 'substance'

import EditorPackage from './editor/EditorPackage'
import TextureConfigurator from './editor/util/TextureConfigurator'
import JATSImporter from './converter/JATSImporter'
import JATSImportDialog from './converter/JATSImportDialog'
import JATSExporter from './converter/JATSExporter'
import createEntityDbSession from './entities/createEntityDbSession'

/*
  Texture Component
  Based on given mode prop, displays the Publisher, Author or Reader component
*/
export default class Texture extends Component {

  constructor(parent, props) {
    super(parent, props)
    this.configurator = new TextureConfigurator()
    this.configurator.import(EditorPackage)

    // TODO: we need to see where the best place is for the entityDb
    this.entityDbSession = createEntityDbSession()
    this.entityDb = this.entityDbSession.getDocument()

  }

  getInitialState() {
    return {
      editorSession: null,
      loadingError: null
    }
  }

  getChildContext() {
    return {
      xmlStore: {
        readXML: this.props.readXML,
        writeXML: this.props.writeXML
      },
      exporter: {
        export(dom) {
          const entityDb = this.entityDb
          let jatsExporter = new JATSExporter()
          return jatsExporter.export(dom, { entityDb })
        }
      },
      entityDb: this.entityDb,
      entityDbSession: this.entityDbSession,
      // TODO: Update components to use entityDb, entityDbSession instead.
      get db() {
        console.warn('DEPRECATED: use context.entityDb instead')
        return this.entityDb
      },
      dbSession: this.entityDbSession
    }
  }

  didMount() {
    // load the document after mounting
    setTimeout(() => {
      this._loadDocument(this.props.documentId)
    }, 200)
  }

  willReceiveProps(newProps) {
    if (newProps.documentId !== this.props.documentId) {
      this.dispose()
      this.state = this.getInitialState()
      this._loadDocument(newProps.documentId)
    }
  }

  dispose() {
    // Note: we need to clear everything, as the childContext
    // changes which is immutable
    this.empty()
  }

  render($$) {
    let el = $$('div').addClass('sc-texture')

    if (this.state.loadingError) {
      el.append(this.state.loadingError)
    }

    if (this.state.editorSession) {
      el.append(
        $$(EditorPackage.Editor, {
          documentId: this.props.documentId,
          editorSession: this.state.editorSession
        })
      )
    } else if (this.state.importerErrors) {
      el.append(
        $$(JATSImportDialog, { errors: this.state.importerErrors })
      )
    }
    return el
  }

  getConfigurator() {
    return this.configurator
  }

  _loadDocument() {
    const configurator = this.getConfigurator()
    this.props.readXML(this.props.documentId, (err, xmlStr) => {
      let dom = DefaultDOMElement.parseXML(xmlStr)
      if (err) {
        console.error(err)
        this.setState({
          loadingError: new Error('Loading failed')
        })
        return
      }
      const doctype = dom.getDoctype()
      if (doctype.publicId !== 'TextureJATS 1.1') {
        let jatsImporter = new JATSImporter()
        let result = jatsImporter.import(dom, { entityDb: this.entityDb })
        if (result.hasErrored) {
          console.error('Could not transform to TextureJATS')
          this.setState({
            importerErrors: result.errors
          })
          return
        }
      }
      const importer = configurator.createImporter('texture-jats')
      const doc = importer.importDocument(dom)

      window.doc = doc
      window.entityDb = this.entityDb
      // create editor session
      const editorSession = new EditorSession(doc, {
        configurator: configurator,
        context: this.getChildContext()
      })

      this.setState({
        editorSession: editorSession
      })
    })
  }

}
