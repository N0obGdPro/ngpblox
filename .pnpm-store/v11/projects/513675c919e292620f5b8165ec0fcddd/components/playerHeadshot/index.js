import { useEffect, useState } from "react";
import { createUseStyles } from "react-jss";
import { getBaseUrl } from "../../lib/request";
import { reportImageFail } from "../../services/metrics";
import { multiGetUserHeadshots } from "../../services/thumbnails";

const useStyles = createUseStyles({
  image: {
    maxWidth: '400px',
    width: '100%',
    margin: '0 auto',
    height: 'auto',
    display: 'block',
  },
})

/**
 * Player headshot
 * @param {{id: number; name: string; size?: string;}} props 
 * @returns 
 */
const PlayerHeadshot = (props) => {
  const s = useStyles();
  const size = props.size || 420;
  const [image, setImage] = useState(getBaseUrl() + '/img/placeholder.png');
  useEffect(() => {
    multiGetUserHeadshots({
      userIds: [props.id],
      size: size + 'x' + size,
    }).then(image => {
      let u = image.find(v => v.targetId == props.id);
      setImage(u && u.imageUrl ? u.imageUrl : getBaseUrl() + '/img/placeholder.png');
    }).catch(() => {
      setImage(getBaseUrl() + '/img/placeholder.png');
    });
  }, [props.id]);

  return <img className={s.image} src={image} alt={props.name} onError={(e) => {
    if (image !== getBaseUrl() + '/img/placeholder.png') {
      reportImageFail({
        errorEvent: e,
        type: 'playerHeadshot',
        src: image,
      });
      setImage(getBaseUrl() + '/img/placeholder.png');
    }
  }}></img>
}

export default PlayerHeadshot;
