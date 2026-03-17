export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
}

export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export const generateProxyAddress = () => {
  const servers = ['proxy1', 'proxy2', 'proxy3']
  const port = Math.floor(Math.random() * 65000) + 1000
  const secret = Math.random().toString(36).substring(2, 15).toUpperCase()
  
  return {
    server: `${servers[Math.floor(Math.random() * servers.length)]}.mtproxy.ru`,
    port,
    secret,
    address: `${servers[Math.floor(Math.random() * servers.length)]}.mtproxy.ru:${port}`
  }
}
