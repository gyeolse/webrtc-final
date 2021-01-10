import './App.css';
import React, {useState} from 'react';
import io from 'socket.io-client';
import {useRef} from 'react';
import {useEffect} from 'react';

const App = () => {
  const [pc, setPc] = useState<RTCPeerConnection>(); // RTCPeerConnection
  const [socket, setSocket] = useState<SocketIOClient.Socket>(); //singaling server와 통신할 socket

  let localVideoRef = useRef<HTMLVideoElement>(null); //본인의 video, audio를 재생할 video 태그의 ref
  let remoteVideoRef = useRef<HTMLVideoElement>(null); //상대방의 Video, autio를 재생할 video 태그의 ref

  //RTCPeerConnection을 생성할 때의 Config
  const pc_config = {
    "iceServers": [
      // {
      //   urls: 'stun:3.34.249.175:3000'
      //   // 'credentials': '[YOR CREDENTIALS]',
      //   // 'username': '[USERNAME]'
      // }
      {
        urls : 'stun:stun.l.google.com:19302'
      }
    ]
  }

  //socket 관련 이벤트 useEffect에 다 때려박음
  useEffect(() => {
    // let newSocket = io('https://rchatting.shop', {transports: ['websocket']});
   let newSocket = io.connect('https://rchatting.shop');
    let newPC = new RTCPeerConnection(pc_config);

    //all_user :
    newSocket.on('all_users', (allUsers: Array<{id: string, email: string}>) => {
      let len = allUsers.length;
      if (len > 0) {
        createOffer();
      }
    });
  
    newSocket.on('getOffer', (sdp: RTCSessionDescription) => {
      //console.log(sdp);
      console.log('get offer');
      createAnswer(sdp);
    });
  
    newSocket.on('getAnswer', (sdp: RTCSessionDescription) => {
      console.log('get answer');
      newPC.setRemoteDescription(new RTCSessionDescription(sdp));
      //console.log(sdp);
    });
  
    newSocket.on('getCandidate', (candidate: RTCIceCandidateInit) => {
      newPC.addIceCandidate(new RTCIceCandidate(candidate)).then(() => {
        console.log('candidate add success');
      })
    })

    setSocket(newSocket);
    setPc(newPC);

    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    }).then(stream => {
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach(track => {
        newPC.addTrack(track, stream);
      })
      newPC.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('onicecandidate');
          newSocket.emit('candidate', e.candidate);
        }
      }
      newPC.oniceconnectionstatechange = (e) => {
        console.log(e);
      }
      
      newPC.ontrack = (ev) => {
        console.log('add remotetrack success');
        if(remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
      } 

      newSocket.emit('join_room', {room: '1234', email: 'sample@naver.com'});
      
    }).catch(error => {
      console.log(`getUserMedia error: ${error}`);
    });
    

  const createOffer = () => {
    console.log('create offer');
    newPC.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true})
      .then(sdp => {
        newPC.setLocalDescription(new RTCSessionDescription(sdp));
        newSocket.emit('offer', sdp);
      })
      .catch(error => {
        console.log(error);
      })
    }

    const createAnswer = (sdp: RTCSessionDescription) => {
        newPC.setRemoteDescription(new RTCSessionDescription(sdp)).then(() => {
          console.log('answer set remote description success');
          newPC.createAnswer({offerToReceiveVideo: true, offerToReceiveAudio: true})
          .then(sdp1 => {
            
           console.log('create answer');
            newPC.setLocalDescription(new RTCSessionDescription(sdp1));
            newSocket.emit('answer', sdp1);
          })
          .catch(error => {
            console.log(error);
          })
        })
      
    }

  }, []);

  // 본인과 상대방의 video 렌더링
  return (
    <div>
        <video
          style={{
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: 'black'
          }}
          muted
          ref={ localVideoRef }
          autoPlay>
        </video>
        <video
          id='remotevideo'
          style={{
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: 'black'
          }}
          ref={ remoteVideoRef }
          autoPlay>
        </video>
      </div>
  );
}


export default App;
