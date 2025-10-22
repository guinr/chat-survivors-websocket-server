import { userCache } from '../core/userCache.js';
import { getTwitchAccessToken, fetchTwitchUserInfo } from '../core/twitchApi.js';

export async function handleAuth(ws, message, logger) {
  const { token } = message;

  if (!token) {
    logger.warn('[AUTH] Mensagem auth recebida sem token');
    ws.send(JSON.stringify({ error: 'Token não fornecido' }));
    return;
  }

  try {
    // Decodificar JWT para extrair user_id
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = decoded.user_id;

    if (!userId) {
      logger.warn('[AUTH] Token JWT não contém user_id válido');
      ws.send(JSON.stringify({ error: 'Token JWT inválido' }));
      return;
    }

    // Retornar user_id para o cliente
    ws.send(JSON.stringify({ user_id: userId }));
    logger.info(`[AUTH] User ID ${userId} retornado para cliente`);

    // Verificar se já temos no cache
    if (userCache.has(userId)) {
      logger.info(`[AUTH] Usuário ${userId} já está no cache`);
      return;
    }

    // Buscar informações do Twitch
    logger.info(`[AUTH] Buscando display_name para usuário ${userId}`);
    const accessToken = await getTwitchAccessToken();
    const userInfo = await fetchTwitchUserInfo(userId, accessToken);

    if (!userInfo) {
      logger.warn(`[AUTH] Usuário ${userId} não encontrado na API do Twitch`);
      return;
    }

    // Armazenar no cache
    userCache.set(userId, userInfo.display_name);
    logger.info(`[AUTH] Display_name '${userInfo.display_name}' armazenado para usuário ${userId}`);

  } catch (error) {
    logger.error({ error: error.message }, '[AUTH] Falha ao processar autenticação');
    ws.send(JSON.stringify({ error: 'Erro interno de autenticação' }));
  }
}