# Pages Preview Deployments

## Purpose

Provide a browser-accessible Game and Terrain Lab build for `master` and every same-repository pull request without requiring an owner to install dependencies or run a local server.

## URLs

The GitHub Pages base URL is resolved by the deployment workflow.

- Production Game: `<pages-base>/`
- Production Terrain Lab: `<pages-base>/terrain-lab/`
- Pull-request Game: `<pages-base>/pr-<number>/`
- Pull-request Terrain Lab: `<pages-base>/pr-<number>/terrain-lab/`

## Deployment contract

- Production deploys after a push to `master`.
- A pull-request preview deploys only after the `CI` workflow completes successfully.
- Preview input is the `web-app-builds` artifact produced by CI; the privileged deployment job never checks out or executes pull-request code.
- The `pages-state` branch persists production and all active preview directories.
- Deployments are serialized through one concurrency group so parallel pull requests cannot overwrite one another.
- Closing a pull request removes its `pr-<number>` directory and republishes the complete site.
- The workflow creates or updates one marked pull-request comment containing the Game and Terrain Lab links.

## Asset-path contract

Both Vite applications use `base: './'`. Generated assets are therefore relative to each deployed `index.html` and the same build layout works at the production root and under arbitrary pull-request paths.

## Initial repository setting

GitHub Pages must use **GitHub Actions** as its publishing source. The workflow uses the official `configure-pages`, `upload-pages-artifact`, and `deploy-pages` actions. If Pages has not been enabled for the repository yet, an administrator performs this one-time setting:

`Settings → Pages → Build and deployment → Source → GitHub Actions`

No local build or command-line step is required for subsequent previews.
