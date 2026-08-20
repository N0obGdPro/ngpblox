import { useEffect, useRef, useState } from "react";
import { createContainer } from "unstated-next";
import { getAvatar, getMyAvatar, getRules, redrawMyAvatar, setColors as setColorsRequest, setWearingAssets as setWearingAssetsRequest } from "../services/avatar";
import { multiGetUserThumbnails } from "../services/thumbnails";

const CharacterCustomizationStore = createContainer(() => {
  const [rules, setRules] = useState(null);
  const [wearingAssets, setWearingAssets] = useState(null);
  const [colors, setColors] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isModified, setIsModified] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  // Loading the current avatar must not count as an edit.  Previously the
  // change counter needed two user interactions before Save Changes appeared.
  const hasLoadedAvatar = useRef(false);

  useEffect(() => {
    if (!userId) return;
    hasLoadedAvatar.current = false;
    getMyAvatar().then(result => {
      setWearingAssets(result.assets.map(v => {
        return {
          assetId: v.id,
          name: v.name,
          assetType: v.assetType,
        }
      }));
      setColors(result.bodyColors);
      hasLoadedAvatar.current = true;
    })
  }, [userId]);

  useEffect(() => {
    if (!hasLoadedAvatar.current) return;
    setIsModified(true);
  }, [wearingAssets, colors]);

  useEffect(() => {
    if (!isRendering) return;
    setIsModified(false);
    const timer = setInterval(() => {
      multiGetUserThumbnails({
        userIds: [userId],
      }).then(result => {
        const user = result[0];
        if (user.state === 'Completed' && typeof user.imageUrl === 'string') {
          setIsRendering(false);
          setThumbnail(user.imageUrl);
          clearInterval(timer);
        }
      });
    }, 2500);

    return () => {
      clearInterval(timer);
    }
  }, [isRendering]);

  const requestRender = async (force = false) => {
    if (!colors || !wearingAssets || isRendering) return;
    try {
      await setColorsRequest(colors);
      await setWearingAssetsRequest({ assetIds: wearingAssets.map(v => v.assetId) });
      if (force) await redrawMyAvatar();
      setIsRendering(true);
      setThumbnail(null);
    } catch (e) {
      console.error('[avatar] could not save avatar changes', e);
      setIsModified(true);
    }
  }

  useEffect(() => {
    getRules().then(res => {
      setRules(res);
    })
  }, []);

  return {
    rules,
    setRules,

    userId,
    setUserId,

    wearingAssets,
    setWearingAssets,

    colors,
    setColors,

    isRendering,
    setIsRendering,

    thumbnail,
    setThumbnail,

    isModified,
    setIsModified,

    requestRender,
  }
});

export default CharacterCustomizationStore;
