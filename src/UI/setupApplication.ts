// tslint:disable no-expression-statement
import express, { Application as ExpressApplication } from 'express'
import fs from 'fs'
import path from 'path'

const filesFolder = path.resolve(__dirname, 'files')
const indexHTMLFile = path.resolve(__dirname, 'index.html')

export const setupApplication = (app: ExpressApplication): void => {
  const APP_TITLE = app.get('title')
  const indexHTML = fs
    .readFileSync(indexHTMLFile)
    .toString()
    .replace(/\[\[TITLE\]\]/g, APP_TITLE)
  app.use('/files', express.static(filesFolder))
  app.get('/', (_, res) => res.send(indexHTML))
}
