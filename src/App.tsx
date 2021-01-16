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
//   let newSocket = io.connect('https://rchatting.shop');
    let newSocket = io.connect('http://localhost:8080');

    let newPC = new RTCPeerConnection(pc_config);

    //on 함수 : ('서버에서 받을 이벤트명, function(데이터))
    //emit 함수 : 

    //all_users : 자신을 제외한 모든 user의 목록을 받아온다. 
    newSocket.on('all_users', (allUsers: Array<{id: string, email: string}>) => {
//      console.log(allUsers);
      let len = allUsers.length;
      if (len > 0) {        
        //Sinaling Server를 통해 Peer2에게 전달하는 역할
        //늦게들어온 사람 입장에서 호출될 것임.
        createOffer(); //1명 이상이라면, 해당 방에 들어있는 user들에게 createOffer함수를 보내도록 함. 
      }
    });
  
    //getOffer : 상대방의 offer signal 데이터로 상대방의 RTCSessionDescription을 받는다.
    newSocket.on('getOffer', (sdp: RTCSessionDescription) => {
      console.log(sdp);
      console.log('get offer');
      createAnswer(sdp); //createAnswer을 통해, 자신의 SessionDescription을 생성하고, SignalingServer를 통해 늦게들어온사람(Caller) 에게 전달
    });
  
    //getAnswer : 본인의 RTCPeerConnection의 RemoteDescription으로 상대방의 RTCSessionDesription을 설정    
    newSocket.on('getAnswer', (sdp: RTCSessionDescription) => {
      console.log('get answer'); //늦게 들어온 사람 입장(Caller)에서 출력됨. 즉, getOffer에 대한 대답이라고 생각하면 됨
      newPC.setRemoteDescription(new RTCSessionDescription(sdp)); //본인꺼에다가 상대방 sdp를 설정시킴
      //console.log(sdp);
    });
  
    //## Peer1과 Peer2 모두 자신의 SessionDescription을 생성한 후부터 자신의 ICECandidate 정보를 생성하기 시작하고 이를 각각 서로에게 전달한다.

    //getCandidate : 본인 RTCPeerConnection의 IceCandidate로 상대방의 RTCIceCandidate를 설정한다.
    newSocket.on('getCandidate', (candidate: RTCIceCandidateInit) => {
      newPC.addIceCandidate(new RTCIceCandidate(candidate)).then(() => {
        console.log('candidate add success');
      })
    })

    //hook setter
    setSocket(newSocket);
    setPc(newPC);
    //1. getUserMedia : 접근 권한 필요. 
    //MediaStream 설정 및 RTCPeerConnection 이벤트 관련. 
    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    }).then(stream => {
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // 자신의 video, audio track을 모두 자신의 RTCPeerConnection에 등록함. 
      stream.getTracks().forEach(track => {
        newPC.addTrack(track, stream);
      })

      //offer 또는 answer signal을 생성한 이후부터, 본인의 icecandidate 이벤트가 계속 발생한다. 
      //offer 또는 answer을 보냈던 상대방에게 본인의 icecandidate 정보를 signaling server를 통해서 보낸다.
      newPC.onicecandidate = (e) => {
        if (e.candidate) {
          console.log('onicecandidate');
          newSocket.emit('candidate', e.candidate);
        }
      }

      //ice connection 상태가 변경될 경우 출력
      newPC.oniceconnectionstatechange = (e) => {
        console.log(e);
      }
      
      //상대방의 RTCSessionDescription을 본인의 RTCPeerConnection에서의 remoteSessionDescription으로 지정하면,
      //상대방의 track데이터에 대한 이벤트가 발생함
      //해당 데이터에서 MediaStream을 상대방의 Video, Audio를 재생할 Video 태그에 등록함. 
      newPC.ontrack = (ev) => {
        console.log('add remotetrack success');
        if(remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
      } 

      //서버에 알림. 자신의 video, audio track을 모두 자신의 RTCPeerConnection에 등록한 후, room에 접속했다고 signaling server에 알려야함. 
      //offer or answer을 주고받을 때, RTCSesscionDescription에 해당 video, audio track에 대한 정보가 담겨있기 때문에,
      //순서를 어기면 상대방의 MediaStream을 주고받을 수 없기 때문임. 
      newSocket.emit('join_room', {room: '1234', email: 'testuser@naver.com'});
      
    }).catch(error => {
      console.log(`getUserMedia error: ${error}`);
    });
    
//상대방에게 offer signal을 보내는 함수 
  const createOffer = () => {
    console.log('create offer');
    //rtc api
    newPC.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true})
      .then(sdp => {
        newPC.setLocalDescription(new RTCSessionDescription(sdp));
        newSocket.emit('offer', sdp);
      })
      .catch(error => {
        console.log(error);
      })
    }

//상대방에게 answer signal을 보내는 함수 
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
