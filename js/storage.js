/**
 * Camada de persistência (localStorage).
 *
 * Isolada do restante da aplicação para que, no futuro, seja simples trocar
 * por uma API/back-end sem mexer nas telas.
 */
(function (App) {
  'use strict';

  const { STORAGE_KEY } = App.config;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('[storage] Não foi possível ler os dados salvos.', error);
      return null;
    }
  }

  /** @returns {boolean} `true` se os dados foram gravados com sucesso. */
  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error('[storage] Não foi possível salvar os dados.', error);
      return false;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[storage] Não foi possível limpar os dados.', error);
    }
  }

  /** Tamanho aproximado ocupado pelos dados, em bytes. */
  function usage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '';
      return new Blob([raw]).size;
    } catch (error) {
      return 0;
    }
  }

  App.storage = { key: STORAGE_KEY, load, save, clear, usage };
})(window.App);
