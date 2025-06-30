# Настройка Shadowsocks для Claude API

## Установка на VPS (Ubuntu)

1. **Установка shadowsocks-libev:**
```bash
sudo apt update
sudo apt install shadowsocks-libev -y
```

2. **Создание конфигурации:**
```bash
cat > /tmp/ss-config.json << 'EOF'
{
    "server": "188.130.208.33",
    "server_port": 38765,
    "local_address": "127.0.0.1",
    "local_port": 1080,
    "password": "jrVvCICd0fcb2wS1A15AW5",
    "method": "chacha20-ietf-poly1305",
    "timeout": 300
}
EOF
```

3. **Запуск локального SOCKS5 прокси:**
```bash
# В фоновом режиме
nohup ss-local -c /tmp/ss-config.json > /tmp/ss.log 2>&1 &

# Или как сервис (рекомендуется)
sudo systemctl enable shadowsocks-libev-local@config
sudo systemctl start shadowsocks-libev-local@config
```

4. **Проверка работы:**
```bash
# Проверяем что прокси слушает на порту 1080
netstat -tlnp | grep 1080

# Тестируем через curl
curl --socks5 127.0.0.1:1080 https://httpbin.org/ip
```

5. **Обновление .env:**
```bash
# В файле .env замените:
PROXY_URL=socks5://127.0.0.1:1080
```

## Альтернативный способ через Docker

```bash
# Запуск Shadowsocks клиента в Docker
docker run -d --name shadowsocks-local \
  -p 1080:1080 \
  shadowsocks/shadowsocks-libev:latest \
  ss-local -s 188.130.208.33 -p 38765 \
  -k "jrVvCICd0fcb2wS1A15AW5" \
  -m chacha20-ietf-poly1305 \
  -l 1080 -b 0.0.0.0
```

## Интеграция в docker-compose.yml

Добавьте сервис:

```yaml
services:
  shadowsocks:
    image: shadowsocks/shadowsocks-libev:latest
    command: ss-local -s 188.130.208.33 -p 38765 -k "jrVvCICd0fcb2wS1A15AW5" -m chacha20-ietf-poly1305 -l 1080 -b 0.0.0.0
    ports:
      - "1080:1080"
    restart: unless-stopped

  app:
    # ... существующая конфигурация
    depends_on:
      - shadowsocks
```

После этого Claude API будет работать через Shadowsocks прокси. 