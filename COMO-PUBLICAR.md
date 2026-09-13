# Como publicar pelo GitHub

## 1. Criar o repositório
No GitHub: **New repository** → nome `clt-code` → **Private** (ou público, tanto faz) → **Create**.
Não marque "Add a README" — esta pasta já tem um.

## 2. Enviar esta pasta
Esta pasta já é um repositório Git com o primeiro commit feito.
No terminal, dentro dela:

```bash
git remote add origin https://github.com/SEU-USUARIO/clt-code.git
git branch -M main
git push -u origin main
```

Sem terminal: no GitHub, **Add file → Upload files**, arraste todos os arquivos
(inclusive a pasta `api`) e clique em **Commit changes**.

## 3. Ligar na Vercel
vercel.com → **Add New → Project** → **Import** o repositório `clt-code`.

- Framework Preset: **Other**
- Build Command, Output Directory e Install Command: **deixe vazios**
- **Deploy**

A partir daí, todo `git push` publica sozinho.

## 4. Deixar o site público
**Settings → Deployment Protection → Vercel Authentication → Disabled → Save**

Sem isso, só quem estiver logado na sua conta Vercel consegue abrir.

## 5. (Opcional) Ligar a busca de preço real
**Settings → Environment Variables** → `SERPAPI_KEY` = sua chave → Redeploy.
Sem a chave, a busca continua funcionando com o catálogo de referência.
