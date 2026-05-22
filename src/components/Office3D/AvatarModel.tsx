'use client';

import { Sphere } from '@react-three/drei';
import type { AgentConfig } from './agentsConfig';
import { useEffect, useState } from 'react';

interface AvatarModelProps {
  agent: AgentConfig;
  position: [number, number, number];
}

export default function AvatarModel({ agent, position }: AvatarModelProps) {
  const modelPath = `/models/${agent.id}.glb`;
  const [exists, setExists] = useState<boolean>(false);

  // Check if file exists before trying to load
  useEffect(() => {
    fetch(modelPath, { method: 'HEAD' })
      .then(res => setExists(res.ok))
      .catch(() => setExists(false));
  }, [modelPath]);

  if (!exists) {
    return (
      <Sphere
        args={[0.3, 16, 16]}
        position={position}
        castShadow
      >
        <meshStandardMaterial
          color={agent.color}
          emissive={agent.color}
          emissiveIntensity={0.3}
        />
      </Sphere>
    );
  }

  return (
    <Sphere
      args={[0.3, 16, 16]}
      position={position}
      castShadow
    >
      <meshStandardMaterial
        color={agent.color}
        emissive={agent.color}
        emissiveIntensity={0.3}
      />
    </Sphere>
  );
}
