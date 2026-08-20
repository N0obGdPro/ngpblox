import {createContainer} from "unstated-next";
import {useReducer, useRef, useState} from "react";
import {multiGetAssetThumbnails, multiGetGroupIcons, multiGetUserThumbnails} from "../services/thumbnails";

const getKey = (id, type, size) => {
  return type + '_' + id + '_' + size;
}

const thumbnailReducer = (prev, action) => {
  let newData = {...prev};
  if (action.event === 'MULTI_ADD') {
    for (const item of action.thumbnails) {
      newData[getKey(item.targetId, action.type, action.size)] = item.imageUrl;
    }
  }

  return newData;
}

const ThumbnailStore = createContainer(() => {
  const [thumbnails, dispatchThumbnails] = useReducer(thumbnailReducer, {});

  const pendingState = useRef({
    pending: false,
    pendingCount: 0,
    pendingTimer: 0,
    pendingItems: [],
  });
  const retryTimers = useRef({});

  const scheduleRetry = (id, type, size) => {
    const key = getKey(id, type, size);
    if (retryTimers.current[key]) return;
    retryTimers.current[key] = setTimeout(() => {
      delete retryTimers.current[key];
      requestThumbnail(id, type, size);
    }, 2000);
  };

  const doWithRetry = (cb) => {
    (async () => {
      try {
        await cb();
      } catch (e) {
        // A local install may not have the optional thumbnail renderer.
        // Keep the placeholder rather than retrying the same request forever.
        console.warn('[thumbnail] request failed; using placeholder', e);
      }
    })();
  }

  const fetchThumbnails = () => {
    const copy = pendingState.current;
    pendingState.current = {
      pending: false,
      pendingCount: 0,
      pendingTimer: 0,
      pendingItems: copy.pendingItems,
    };
    const getAndProcessThumbnails = (type, cb) => {
      // todo: size support?
      const assets = copy[type];
      if (assets && assets.length) {
        for (const t of assets) {
          pendingState.current.pendingItems.push(getKey(t.id, type, '420x420'));
        }
        doWithRetry(async () => {
          const data = await cb(assets);
          // A Pending response has no URL yet.  Do not cache it as a missing
          // thumbnail; poll it again after the renderer has had time to run.
          const returned = new Map(data.map(item => [String(item.targetId), item]));
          const ready = [];
          for (const requested of assets) {
            const key = getKey(requested.id, type, '420x420');
            pendingState.current.pendingItems = pendingState.current.pendingItems.filter(v => v !== key);
            const item = returned.get(String(requested.id));
            if (!item || item.state === 'Pending' || !item.imageUrl) {
              scheduleRetry(requested.id, type, '420x420');
            } else {
              ready.push(item);
            }
          }
          if (ready.length) {
            dispatchThumbnails({
              event: 'MULTI_ADD',
              type: type,
              size: '420x420',
              thumbnails: ready,
            });
          }
        })
      }
    }
    getAndProcessThumbnails('asset', (items) => {
      return multiGetAssetThumbnails({
        assetIds: items.map(v => v.id),
      });
    });
    getAndProcessThumbnails('userThumbnail', (items) => {
      return multiGetUserThumbnails({
        userIds: items.map(v => v.id),
        size: '420x420',
        format: 'png',
      });
    });
    getAndProcessThumbnails('groupIcon', (items) => {
      return multiGetGroupIcons({
        groupIds: items.map(v => v.id),
      });
    });
  }
  const requestThumbnail = (id, type, size) => {
    if (!pendingState.current[type]) {
      pendingState.current[type] = []
    }
    let exists = pendingState.current[type].find(v => v.id === id);
    if (exists)
      return;

    if (pendingState.current.pendingItems.includes(getKey(id, type, size)))
      return;

    pendingState.current[type].push({
      id: id,
      size: size,
    });
    pendingState.current.pendingCount++;
    if (!pendingState.current.pending) {
      pendingState.current.pending = true;
      pendingState.current.pendingTimer = setTimeout(() => {
        fetchThumbnails();
      }, 10);
    }else if (pendingState.current.pendingCount >= 50) {
      clearTimeout(pendingState.current.pendingTimer);
      fetchThumbnails();
    }
  }

  const getPlaceholder = () => {
    return '/img/placeholder.png';
  };

  const getThumbnailHandler = (type) => {
    return (id, size = '420x420') => {
      if (!['420x420'].includes(size)) {
        throw new Error('Invalid size');
      }

      const t = thumbnails[getKey(id, type, size)];
      // if t is null, the image is pending/blocked/not available, so don't try to get it again.
      if (t === null || (typeof t === 'string' && t.length === 0)) {
        return getPlaceholder();
      }
      if (t === undefined) {
        requestThumbnail(id, type, size);
        return '/img/placeholder.png';
      }
      return t;
    }
  }

  const getThumbnailRemovalHandler = (type) => {
    return (id, size='420x420') => {
      delete thumbnails[getKey(id, type, size)];
    }
  }

  return {
    thumbnails,

    getUserThumbnail: getThumbnailHandler('userThumbnail'),
    getAssetThumbnail: getThumbnailHandler('asset'),
    getGroupIcon: getThumbnailHandler('groupIcon'),
    removeUserThumbnail: getThumbnailRemovalHandler('userThumbnail'),

    getPlaceholder,
  }
});

export default ThumbnailStore;
