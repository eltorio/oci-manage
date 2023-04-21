# 1. Laboratoire Oracle OCI-Kubernetes *bare metal*

**Ce projet n'a pas vocation a être réutilisé il s'agit en quelque sorte de notes bien structurées**  
**Si il vous est utile tant mieux !**  
**Si vous avez des corrections, des ajouts, des idées ils sont les bienvenus**  

- [1. Laboratoire Oracle OCI-Kubernetes *bare metal*](#1-laboratoire-oracle-oci-kubernetes-bare-metal)
  - [1.1. Objectifs](#11-objectifs)
  - [1.2. Pré-requis](#12-pré-requis)
  - [1.3. Architecture](#13-architecture)
    - [1.3.1. Structure des locations](#131-structure-des-locations)
    - [1.3.2. Choix](#132-choix)
    - [1.3.3. Création des instances *les nœuds*](#133-création-des-instances-les-nœuds)
    - [1.3.4. Réseau](#134-réseau)
      - [1.3.4.1. Cas multi-locations](#1341-cas-multi-locations)
        - [1.3.4.1.1. Création des passerelles d'appairage locales](#13411-création-des-passerelles-dappairage-locales)
          - [1.3.4.1.1.1. Requérant](#134111-requérant)
          - [1.3.4.1.1.2. "Acceptant"](#134112-acceptant)
- [2. Installation du control-plane](#2-installation-du-control-plane)
  - [2.1. 1 - connection à distance sur l'instance (avec la clef super-privée) et création de l'utilisateur d'exploitation](#21-1---connection-à-distance-sur-linstance-avec-la-clef-super-privée-et-création-de-lutilisateur-dexploitation)
  - [2.2. 2 - login en tant qu'exploitant](#22-2---login-en-tant-quexploitant)
  - [2.3. 3 - installation des logiciels](#23-3---installation-des-logiciels)
  - [2.4. compilation de cri-dockerd](#24-compilation-de-cri-dockerd)
  - [2.5. installation du client cilium](#25-installation-du-client-cilium)
  - [2.6. creation manuelle du fichier `/etc/hosts` du control plane](#26-creation-manuelle-du-fichier-etchosts-du-control-plane)
  - [2.7. definitions du firewall](#27-definitions-du-firewall)
- [3. Installation des nœuds actifs (workers) depuis le control-plane](#3-installation-des-nœuds-actifs-workers-depuis-le-control-plane)
- [4. Quand tous les nœuds sont pré-installés](#4-quand-tous-les-nœuds-sont-pré-installés)
  - [4.1. déployer le fichier hosts](#41-déployer-le-fichier-hosts)
  - [4.2. déployer le certificat racine](#42-déployer-le-certificat-racine)
  - [4.3. déployer la configuration HAProxy](#43-déployer-la-configuration-haproxy)
  - [4.4. mise à jour des paquets:](#44-mise-à-jour-des-paquets)
  - [4.5. redémarrer le cluster](#45-redémarrer-le-cluster)
  - [4.6. déployer un fichier](#46-déployer-un-fichier)
  - [4.7. déployer le firewall](#47-déployer-le-firewall)
  - [4.8. (re)créer les fichiers d'interface locale *ex: en cas de modification du routage*](#48-recréer-les-fichiers-dinterface-locale-ex-en-cas-de-modification-du-routage)
- [5. Déploiement du cluster](#5-déploiement-du-cluster)
  - [5.1. Autorité de certification](#51-autorité-de-certification)
  - [5.2. Control-Plane](#52-control-plane)
  - [5.3. Workers](#53-workers)
  - [5.4. Effacement du cluster et résinstallation du cluster](#54-effacement-du-cluster-et-résinstallation-du-cluster)
    - [5.4.1. Effacement](#541-effacement)
    - [5.4.2. Réinstallation](#542-réinstallation)
  - [5.5. Stockage persistant](#55-stockage-persistant)
    - [5.5.1. Longhorn](#551-longhorn)
    - [5.5.2. OpenEBS/jiva](#552-openebsjiva)
  - [5.6. Gestionnaire de certificat](#56-gestionnaire-de-certificat)
  - [5.7. Ouverture sur le monde extérieur](#57-ouverture-sur-le-monde-extérieur)
  - [5.8. Accès aux tableaux de bord](#58-accès-aux-tableaux-de-bord)
  - [5.9. Grafana](#59-grafana)
  - [5.10. Registre local de container](#510-registre-local-de-container)
    - [5.10.1. créer une résolution de nom spécifique:](#5101-créer-une-résolution-de-nom-spécifique)
    - [5.10.2. Pour ajouter une image:](#5102-pour-ajouter-une-image)
    - [5.10.3. Pour désinstaller le registre local:](#5103-pour-désinstaller-le-registre-local)
    - [5.10.4. Interface utilisateur](#5104-interface-utilisateur)
  - [5.11. Letsencrypt](#511-letsencrypt)
    - [5.11.1. Oracle OCI DNS01](#5111-oracle-oci-dns01)
      - [5.11.1.1. Installation](#51111-installation)
      - [5.11.1.2. Utilisation](#51112-utilisation)
      - [5.11.1.3. Désinstallation](#51113-désinstallation)
    - [5.11.2. Azure DNS](#5112-azure-dns)
      - [5.11.2.1. Installation](#51121-installation)
      - [5.11.2.2. Utilisation](#51122-utilisation)
      - [5.11.2.3. Désinstallation](#51123-désinstallation)
  - [5.12. Bird sur le control-plane](#512-bird-sur-le-control-plane)

## 1.1. Objectifs
Créer une maquette bare-metal d'un cluster Kubernetes à l'aide de machine  virtuelles "toujours gratuites" Oracle Cloud Infrastructure.     
Essayer d'automatiser au maximum les tâches de déploiement sans utiliser d'outils spécifiques.  
## 1.2. Pré-requis
- un compte oracle OCI gratuit par personne dans la même région
- une clef ssh "super privée"
- une autorité de certification racine pour générer tous les certificats
- beaucoup de temps !

## 1.3. Architecture
Chaque membre a sa propre "location", il a déployé une, deux, trois ou quatre VM dans sa location.  
### 1.3.1. Structure des locations
- utilisation de la même région OCI
- un compartiment enfant du compartiment racine contenant tous les objets
- un réseau privé virtuel avec un CIDR du type 10.n.0.0/16
- deux sous-réseaux:
  - public: CIDR 10.n.0.0/24
  - privé: CIDR 10.n.1.0/24
- n-1 passerelles LPG (local peering gateways) avec les noms des autres locations
- un VPN site à site entre la location et le routeur Cisco du labo avec BGP
### 1.3.2. Choix
| Élément    | Choix              |
| :--------- | :----------------- |
| Cluster    | Kubernetes v1.27.1 |
| CNI        | Cilium 1.13.2      |
| routage    | BGP                |
| Connexions | VXLAN              |
| VPN        | IKEv2              |
 
### 1.3.3. Création des instances *les nœuds*
Chaque nœud est soit:
- **une instance VM.Standard.A1.Flex (arm64)**
<img width="1223" alt="arm64" src="https://user-images.githubusercontent.com/6966689/230726371-91a67bb4-8830-43df-b36e-7b97596246cb.png">

- **une instance VM.Standard.E2.1.Micro (amd64)** .   
 <img width="1190" alt="amd64" src="https://user-images.githubusercontent.com/6966689/230726465-cbab9f60-0a1a-4ce9-ab37-300301f6af6a.png">

Chaque instance est déployée avec l'image Ubuntu 22.04 minimale. Pourquoi? Parce que c'est l'OS que nous connaissons le mieux. 
Au moment du déploiement de chaque machine virtuelle, nous avons mis une clef SSH que nous appelons la clef "super privée".  Elle nous sert à initier le déploiement.
### 1.3.4. Réseau
- Création des règles de sécurité
  - Réseau public
    - pas de changement
  - Réseau privé
    - on autorise tout (pour le labo)
      - 0.0.0.0/0 => tous les protocoles
      - ::/0 => tous les protocoles  
  
#### 1.3.4.1. Cas multi-locations
Si les nœuds sont dans des locations différentes il faut relier les réseaux privés de chaque location:  

##### 1.3.4.1.1. Création des passerelles d'appairage locales  
- Créer des stratégies  
  - Elles doivent être créées au niveau du compartiment racine  
  - Stratégies du requérant et des "acceptants":  
  
###### 1.3.4.1.1.1. Requérant
```sql
Allow group Administrators to manage local-peering-from in compartment <requestor-compartment>
Endorse group Administrators to manage local-peering-to in any-tenancy
Endorse group Administrators to associate local-peering-gateways in compartment <requestor-compartment> with local-peering-gateways in any-tenancy
```
###### 1.3.4.1.1.2. "Acceptant"
```sql
Define tenancy Requestor as <requestor_tenancy_OCID>
Define group Administrators as <RequestorGrp_OCID>
Admit group Administrators of tenancy Requestor to manage local-peering-to in compartment <acceptor-compartment>
Admit group Administrators of tenancy Requestor to associate local-peering-gateways in tenancy Requestor with local-peering-gateways in compartment <acceptor-compartment>
```
- Liaison des passerelles d'appairage locales (local peering gateways)
  - dans la console OCI/VCN de l'acceptant copier l'ocid de la passerelle "acceptante". 
  <img width="1845" alt="acceptor2" src="https://user-images.githubusercontent.com/6966689/230727586-09d0a2b4-f3d5-4f96-8b3a-dfd3f1a27988.png">
  
  - dans la console OCI/VCN du requérant à droite de la passerelle correspondante on trouve dans le menu "Établir une connexion d'apparage. Il convient d'y coller l'ocid précédent… Si il y a un problème d'autorisation il vient probablement des stratégies mal définies. Voir https://docs.oracle.com/fr-fr/iaas/Content/Network/Tasks/localVCNpeering.htm#Step3  
<img width="1847" alt="requestror" src="https://user-images.githubusercontent.com/6966689/230727600-2de47379-553d-43bf-84f8-2629f176e81e.png">



# 2. Installation du control-plane
## 2.1. 1 - connection à distance sur l'instance (avec la clef super-privée) et création de l'utilisateur d'exploitation
```sh
ssh -i clef_super_privée ubuntu@instance_ip
USERNAME=adminuser
PASSWORD=sonmotdepasse
sudo useradd -m -s /bin/bash -p $PASSWORD $USERNAME
sudo usermod -aG sudo "$USERNAME"
sudo -u "$USERNAME" sh -c "cd &&\
                                mkdir -p .ssh &&\
                                chmod go-rwx .ssh &&\
                                ssh-keygen -q -t ecdsa -f ~/.ssh/id_ecdsa -N ''"
sudo cp /home/ubuntu/.ssh/authorized_keys /home/$USERNAME/.ssh/
sudo -u "$USERNAME" sh -c "cd chmod go-rwx .ssh"
exit
```
## 2.2. 2 - login en tant qu'exploitant
```sh
ssh -i clef_super_privée adminuser@instance_ip
# définition du nom d'hôte
sudo hostnamectl hostname master.private.$compartment.oraclevcn.com
# création d'une clef ssh pour root
sudo ssh-keygen -t ecdsa
#autorisation du login root via ssh
sudo sed -i.bak s/#PermitRootLogin/PermitRootLogin/ /etc/ssh/sshd_config
sudo systemctl restart ssh
#modification du service docker
sudo sed -i.bak '/^\[Service\].*/a MountFlags=shared' /lib/systemd/system/docker.service
```
## 2.3. 3 - installation des logiciels
```sh
# installation du repo officiel Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/trusted.gpg.d/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
# installation du repo officiel Kubernetes
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/google-k8s.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/trusted.gpg.d/google-k8s.gpg] http://apt.kubernetes.io/ kubernetes-xenial main"| sudo tee /etc/apt/sources.list.d/k8s.list
# mise à jour de l'image de base Ubuntu 22.04 LTS (pour une instation propre)
sudo apt-get update && sudo apt-get dist-upgrade && sudo reboot
```
```sh
# installation
sudo apt-get update && sudo apt-get install vim wireguard iputils-ping docker-ce docker-ce-cli containerd.io docker-compose-plugin git golang-go iputils-ping cron kubeadm haproxy kubelet kubectl kubernetes-cni jq
# ajout de l'exploitant comme administrateur docker
sudo usermod -aG docker $USER
sudo reboot
```
## 2.4. compilation de cri-dockerd  
*Attention si le cluster est multi-architecture il faut avoir une version de l'executable pour chaque architecture*  
```sh
git clone https://github.com/Mirantis/cri-dockerd.git
cd cri-dockerd
mkdir bin
go get && go build -o bin/cri-dockerd
mkdir -p /usr/local/bin
sudo install -o root -g root -m 0755 bin/cri-dockerd /usr/local/bin/cri-dockerd
sudo cp -a packaging/systemd/* /etc/systemd/system
sudo sed -i -e 's,/usr/bin/cri-dockerd,/usr/local/bin/cri-dockerd,' /etc/systemd/system/cri-docker.service
```
## 2.5. installation du client cilium
```sh
cluster_init_get_cilium_cli
```
Pour vérifier que tout fonctionne `cilium status`.  
<img width="1083" alt="cilium" src="https://user-images.githubusercontent.com/6966689/230726758-95a7b598-f8a9-4ec1-a597-0a2f069868a3.png">

## 2.6. creation manuelle du fichier `/etc/hosts` du control plane
Le fichier host du contrôle plane permet une résolution de nom statique.  
```hosts
10.0.1.23       node1       node1.private.tenancy1.oraclevcn.com
10.0.0.63                   node1.public.tenancy1.oraclevcn.com
10.0.0.75       master      master.private.tenancy1.oraclevcn.com
10.0.0.54                   oci-master.public.tenancy1.oraclevcn.com
10.1.0.201      node2       node2.private.tenancy2.oraclevcn.com
10.1.1.186                  node2.public.tenancy2.oraclevcn.com
```
## 2.7. definitions du firewall
dans /etc/iptables/rules.v4 a été ajouté sous l'autorisation du port SSH (22):  
```sh
-A INPUT -p tcp -m state --state NEW -m tcp --dport 443 -j ACCEPT -m comment --comment "WEB secure incoming"
-A INPUT -p tcp -m state --state NEW -m tcp --dport 2379:2380 -j ACCEPT -m comment --comment "K8S etcd access"
-A INPUT -p tcp -m state --state NEW -m tcp --dport 4240 -j ACCEPT -m comment --comment "Cilium health API"
-A INPUT -p tcp -m state --state NEW -m tcp --dport 4244 -j ACCEPT -m comment --comment "Cilium Hubble port"
-A INPUT -p tcp -m state --state NEW -m tcp --dport 6443 -j ACCEPT
-A INPUT -p udp -m state --state NEW -m udp --dport 8472 -j ACCEPT -m comment --comment "Cilium VXLAN tunnel"
-A INPUT -p tcp -m state --state NEW -m tcp --dport 10250 -j ACCEPT -m comment --comment "K8S node"
-A INPUT -p tcp -m state --state NEW -m tcp --dport 10257 -j ACCEPT
-A INPUT -p tcp -m state --state NEW -m tcp --dport 10259 -j ACCEPT
-A INPUT -p udp -m state --state NEW -m udp --dport 51820 -j ACCEPT -m comment --comment "Wireguard UDP port"
```
# 3. Installation des nœuds actifs (workers) depuis le control-plane
**Cela ne peut être fait que si les réseaux privés sont interconnectés**  
Jettez un coup d'œil au script `oci-manage`  
Il contient toutes les fonctionsd'automatisations, elles sont non documentées car on manque de courage !  
Au début du fichier il y a un certain nombre de variables…  
Copiez les dans un fichiers `./oci-manage-config.sh` et éditez les.  
Pour activer les fonctions il faut simplement faire `. ./oci-manage`
```sh
EXPLOITANT=adminuser
PASS=unvraimotdepasse
NODE_PUBLIC_IP=1.2.3.4
NODE_PRIVATE_FQDN=oci-node.private.tenancy.oraclevcn.com
PRIVATE_HOST_NAME=oci-node
PRIVATE_MAC=02:00:00:00:00:0F
PRIVATE_IP=10.0.1.267
init_create_admin_user_with_key $NODE_PUBLIC_IP $EXPLOITANT $PASS
init_allow_keys_for_root $NODE_PUBLIC_IP $EXPLOITANT $PASS
init_deploy_admin_keys_to_admin_user $NODE_PUBLIC_IP $EXPLOITANT
init_set_ramdisk $NODE_PUBLIC_IP
init_set_iptables $NODE_PUBLIC_IP
init_set_hostname $NODE_PUBLIC_IP $NODE_PRIVATE_FQDN
#attention ne fonctionne que si cri-dockerd existe dans le cluster pour la bonne architecture
#voir les variables ARM_SRC et X86_64_SRC de oci-manage-config.sh
init_install_software $NODE_PUBLIC_IP $EXPLOITANT
#attendre que la machine soit de retour
init_install_cri_docker $NODE_PUBLIC_IP
# sur les VM avec une carte réseau privée et une publique
# après avoir noté l'adresse mac et l'adresse ip privée de l'instance
init_create_private_interface $NODE_PUBLIC_IP $PRIVATE_MAC $PRIVATE_IP
```
# 4. Quand tous les nœuds sont pré-installés
Mettre à jour la variable CLUSTER_MEMBERS du fichier de configuration.  
Avec oci-manage on peut alors effectuer des tâches "globales"
## 4.1. déployer le fichier hosts
- Créer manuellement le fichier `sudo vi /etc/hosts` du control-plane puis déployez le.  
```sh
cluster_deploy_hosts
```
## 4.2. déployer le certificat racine
celui dans la variable ROOT_CA
```sh
cluster_deploy_ca_cert
```
## 4.3. déployer la configuration HAProxy
```sh
cluster_deploy_haproxy_config_on_members
```
## 4.4. mise à jour des paquets:  
```sh
cluster_apt_dist_upgrade
```
## 4.5. redémarrer le cluster
```sh
cluster_reboot
```
## 4.6. déployer un fichier 
```sh
#en tant que root
cluster_copy_file_as_root /etc/hosts /etc/hosts
#sinon
cluster_copy_file_as_current_user ~/oci-manage ~/oci-manage
cluster_copy_file_as_current_user ~/oci-manage-config.sh ~/oci-manage-config.sh
```
## 4.7. déployer le firewall
```sh
cluster_copy_file_as_root /etc/iptables/rules.v4 /etc/iptables/rules.v4
cluster_run_on_all_members_as_root "iptables-restore -t /etc/iptables/rules.v4"
```
## 4.8. (re)créer les fichiers d'interface locale *ex: en cas de modification du routage*
```sh
cluster_recreate_private_interface
cluster_recreate_master_private_interface
```
# 5. Déploiement du cluster
Normalement toutes les machines sont prêtes, on peut vérifier qu'elles peuvent communiquer entre elles:
```sh
cluster_ping_host_from_members $CONTROL_PLANE_LOCAL
```
C'est tout bon ? On peut passer aux choses sérieuses.
## 5.1. Autorité de certification
pour créer une autorité de certification racine (CA) et une autorité locale (Sub CA) il y a plein de tutos sur Internet. En gros:  
```sh
mkdir ~/certs
cd ~/certs
# CA
openssl genrsa -out myCA.key 4096
openssl req -x509 -new -sha256 -extensions v3_ca -nodes -key myCA.key -sha256 -days 7000 -out myCA.pem
echo "1" > myCA.srl
# SubCA
openssl genrsa -out mySubCA.key 4096
openssl req -new -key mySubCA.key > mySubCA.csr
openssl x509 -req -in mySubCA.csr -out mySubCA.pem -sha256 -extensions v3_ca --CA myCA.pem -days 3650 -CAkey myCA.key -CAcreateserial -CAserial myCA.srl
cat mySubCA.pem myCA.pem > mySubCA-cert-chain.pem
``` 
nous avons créé 3 subca:
- ~/pki/ca.crt et sa clef ~/pki/ca.key c'est l'autorité principale du cluster
- ~/pki/front-proxy.crt et sa clef ~/pki/front-proxy.crt
- ~/pki/etcd/ca.crt et sa clef ~/pki/etcd/ca.key

## 5.2. Control-Plane
À l'aide de `oci-manage`  
```sh
cluster_init_create_control_plane
```

## 5.3. Workers
```sh
cluster_init_create_members ; sleep 30 ; cluster_init_create_post_install
# petit bug avec le dashboard si il répond toujours 404 il faut le recréer…
# kubectl delete -n kube-traefik ingressroute.traefik.containo.us/traefik-dashboard ; cluster_init_install_traefik_ingressroute
```
au bout de quelques minutes, selon le nombre et la performance des VM le cluster sera opérationnel ! On peut le vérifier…  
```sh
kubectl get nodes -o wide
NAME                                         STATUS   ROLES           AGE   VERSION   INTERNAL-IP    EXTERNAL-IP   OS-IMAGE             KERNEL-VERSION       CONTAINER-RUNTIME
node2.private.tenancy2.oraclevcn.com         Ready    <none>          3h   v1.26.3   10.1.1.14      <none>        Ubuntu 22.04.2 LTS   5.15.0-1032-oracle   docker://23.0.3
node3.private.tenancy3.oraclevcn.com         Ready    <none>          3h   v1.26.3   10.2.1.60      <none>        Ubuntu 22.04.2 LTS   5.15.0-1032-oracle   docker://23.0.3
node4.private.tenancy2.oraclevcn.com         Ready    <none>          3h   v1.26.3   10.1.1.142     <none>        Ubuntu 22.04.2 LTS   5.15.0-1032-oracle   docker://23.0.3
node5.private.tenancy4.oraclevcn.com         Ready    <none>          3h   v1.26.3   10.3.1.222     <none>        Ubuntu 22.04.2 LTS   5.15.0-1032-oracle   docker://23.0.3
master.private.tenancy1.oraclevcn.com        Ready    control-plane   3h   v1.26.3   10.0.253.75    <none>        Ubuntu 22.04.2 LTS   5.15.0-1032-oracle   docker://23.0.3
node6.private.tenancy1.oraclevcn.com         Ready    <none>          3h   v1.26.3   10.0.253.201   <none>        Ubuntu 22.04.2 LTS   5.15.0-1032-oracle   docker://23.0.3
node7.private.tenancy5.oraclevcn.com         Ready    <none>          3h   v1.26.3   10.4.1.117     <none>        Ubuntu 22.04.2 LTS   5.15.0-1032-oracle   docker://23.0.3
node8.private.tenancy1.oraclevcn.com         Ready    <none>          3h   v1.26.3   10.0.253.138   <none>        Ubuntu 22.04.2 LTS   5.15.0-1032-oracle   docker://23.0.3
```
Et tous les pods systèmes fonctionnent:  
```sh
3hkubectl get pods -A
NAMESPACE              NAME                                                                 READY   STATUS    RESTARTS       AGE
kube-certmanager       cert-manager-64f9f45d6f-8x7qw                                        1/1     Running   1 (28m ago)    3h
kube-certmanager       cert-manager-cainjector-56bbdd5c47-h2fs9                             1/1     Running   1 (27m ago)    3h
kube-certmanager       cert-manager-webhook-d4f4545d7-qfmmp                                 1/1     Running   1 (27m ago)    3h
kube-system            cilium-6qsgm                                                         1/1     Running   1 (28m ago)    3h
kube-system            cilium-7lqvn                                                         1/1     Running   1 (28m ago)    3h
kube-system            cilium-b52hq                                                         1/1     Running   1 (29m ago)    3h
kube-system            cilium-h8zfq                                                         1/1     Running   1 (30m ago)    3h
kube-system            cilium-kj4bm                                                         1/1     Running   1 (28m ago)    3h
kube-system            cilium-operator-6cff6fb5b7-7zswl                                     1/1     Running   2 (146m ago)   3h
kube-system            cilium-tl8w8                                                         1/1     Running   1 (27m ago)    3h
kube-system            cilium-wmc97                                                         1/1     Running   1 (27m ago)    3h
kube-system            cilium-wzs5v                                                         1/1     Running   1 (146m ago)   3h
kube-system            coredns-787d4945fb-l24v7                                             1/1     Running   1 (146m ago)   3h
kube-system            coredns-787d4945fb-vrgq9                                             1/1     Running   1 (146m ago)   3h
kube-system            etcd-oci-master.private.kerbraoci.oraclevcn.com                      1/1     Running   1 (146m ago)   3h
kube-system            kube-apiserver-oci-master.private.kerbraoci.oraclevcn.com            1/1     Running   1 (146m ago)   3h
kube-system            kube-controller-manager-oci-master.private.kerbraoci.oraclevcn.com   1/1     Running   1 (146m ago)   3h
kube-system            kube-scheduler-oci-master.private.kerbraoci.oraclevcn.com            1/1     Running   1 (146m ago)   3h
kube-traefik           traefik-d65c6d5cd-d8w4j                                              1/1     Running   1 (28m ago)    3h
kubernetes-dashboard   dashboard-metrics-scraper-7bc864c59-d9dqf                            1/1     Running   1 (28m ago)    3h
kubernetes-dashboard   kubernetes-dashboard-7bff9cc896-l8pkd                                1/1     Running   1 (29m ago)    3h
```
## 5.4. Effacement du cluster et résinstallation du cluster  
On est dans un labo alors on doit faire des essais il est très simple d'effacer intégralement le cluster et de le remettre dans la configuration initiale. Deux étapes sont nécessaires:  
### 5.4.1. Effacement 
```sh
cluster_reset_members
# eventuellement une fois les membres disponibles
cluster_reset_storage
# control_plane
cluster_reset_control_plane
```
### 5.4.2. Réinstallation
Pensez à choisir le backend de persistence qui est openEbs par défaut.  
pour utiliser Longhorn il faut changer la variable: `STORAGE_BACKEND="longhorn"`
```sh
rm -f ~/.kube/config
sudo rm -f /root/.kube/config
cluster_init_get_cilium_cli
cluster_init_create_control_plane; sleep 30; cluster_init_create_members ; sleep 30 ; cluster_init_create_post_install
# si besoin
cluster_init_create_post_install_grafana
```

## 5.5. Stockage persistant 
Plusieurs solutions existent.  
### 5.5.1. Longhorn
Si vos nœuds sont suffisament puissants [Longhorn](https://longhorn.io/) fonctionne à merveille. Il ne fonctionne réellement correctement que si tous les nœuds ont au moins 4Go de RAM.  
Sinon les nœuds avec peu de mémoire s'effondrent et le cluster souffre.  
Pour activer Longhorn:  
```sh
cluster_init_install_longhorn
cluster_init_install_longhorn_ingress
```
### 5.5.2. OpenEBS/jiva
C'est une solution plus légère mais sans la belle UI de Longhorn.  
Il est nécessaire de monter les stockages dans /storage sur les membres disposants de stockage de blocs.  
```sh
cluster_init_install_openebs
```

## 5.6. Gestionnaire de certificat
Vu que nous avons notre propre autorité de certification, cert-manager est automatiquement déployé pendant la phase de post-installation.  
Cela permet de créer automatiquement des certificats.  
Cela est très utile pour générer les certificats des Ingress -les routes https entrantes dans le cluster-  
Pour créer automatiquement un certificat pour l'hôte monhote.example.org qui sera stocké dans le secret monhote-cert:
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: monhote-cert
  namespace: default
  labels:
     k8s-app: monapp
spec:
  subject:
      organizations: 
        - macompagnie
  commonName: monhote.example.org
  dnsNames: [monhote.example.org]
  secretName: monhote-certs
  issuerRef:
    name: company-ca-issuer
    kind: ClusterIssuer
```
Pour que la l'Ingress crée automatiquement son certificat pour accèder au service monservice et l'exposer en tant que https://monhote.example.com/:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    cert-manager.io/cluster-issuer: company-ca-issuer
    kubernetes.io/ingress.class: traefik
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
  creationTimestamp: "2023-04-07T05:27:16Z"
  name: monhote-ingress
  namespace: default
spec:
  rules:
  - host: monhote.example.org
    http:
      paths:
      - backend:
          service:
            name: monservice
            port:
              name: http
        path: /
        pathType: Prefix
  tls:
  - hosts: [monhote.example.org]
    secretName: monhote-cert
```
## 5.7. Ouverture sur le monde extérieur
Par défaut tous les nœuds hébergent un proxy [haproxy](https://www.haproxy.org/). Celui-ci relaie le port 443 du service Traefik sur les interfaces locales. Cela permet d'avoir un load balancer basique ouvert sur l'extérieur.  
Pour modifier la configuration il faut éditer le fichier `/etc/haproxy/haproxy.cfg` du control-plane puis de le déployer sur l'ensemble du cluster:  
```sh
cluster_deploy_haproxy_config_on_members
```
la configuration d'un port est simple:
```
frontend traefik
        bind :443
        default_backend k8s-traefik 

backend k8s-traefik
        server site traefik.kube-traefik.svc.cluster.local:443 resolvers dns check inter 1000
```
- `traefik.kube-traefik.svc.cluster.local`
  - `k8s-traefik` est une simple étiquette
  - `traefik` est le nom dns interne d'un service 
  - `kube-traefik` son espace de nom
  - `443` est le port tcp.

## 5.8. Accès aux tableaux de bord
Sur votre DNS faites pointer `TRAEFIK_DASHBOARD_DNS_NAMES`, `HUBBLE_DASHBOARD_DNS_NAMES` et `DASHBOARD_DNS_NAMES` vers les adresses IP des nœuds que vous ouvrez sur l'extérieur (un seul est suffisant).
Notez que `TRAEFIK_DASHBOARD_DNS_NAMES`, `HUBBLE_DASHBOARD_DNS_NAMES` et `DASHBOARD_DNS_NAMES` du fichier `oci-manage-config.sh` sont au pluriel. En effet il s'agit de tableaux bash qui permettent de définir plusieurs nom DNS ainsi par exemple on peut faire pointer `dashboard.domaine.prive` vers l'adresse IP visible depuis l'intérieur du labo et `dashboard.domaine.com` vers l'adresse IP visible depuis Internet. Traefik acceptera les deux noms. Le certificat SSL sera valide pour les deux noms.  
Les tableaux de bord de votre cluster sont accessibles à l'aide de ces noms:
- `https://TRAEFIK_DASHBOARD_DNS_NAMES/dashboard/` (login TRAEFIK_ADMIN/TRAEFIK_ADMIN_PASSWORD)
- `https://HUBBLE_DASHBOARD_DNS_NAMES` (login TRAEFIK_ADMIN/TRAEFIK_ADMIN_PASSWORD)
- `https://DASHBOARD_DNS_NAMES` (login à l'aide du jeton obtenu avec dashboard_get_token)
- `https://LONGHORN_DASHBOARD_DNS_NAMES` (login TRAEFIK_ADMIN/TRAEFIK_ADMIN_PASSWORD)
## 5.9. Grafana
Si vous besoin vous pouvez automatiquement relier votre cluster laboratoire à une instance gratuite [Grafanan](https://grafana.com/)  
Ajustez les valeurs  
```sh
GRAFANA_PROMETHEUS_USERNAME="123456"
GRAFANA_PROMETHEUS_PASSWORD="MTFhM2UyMjkwODQzNDliYzI1ZDk3ZTI5MzkzY2VkMWQgIC0K"
GRAFANA_LOGS_USERNAME="654321"
GRAFANA_LOGS_PASSWORD="MTFhM2UyMjkwODQzNDliYzI1ZDk3ZTI5MzkzY2VkMWQgIC0K"
```
les valeurs sont disponibles dans la section Home/Administration/Data sources de Grafana.  
```sh
cluster_init_create_post_install_grafana
```
<img width="1916" alt="grafana" src="https://user-images.githubusercontent.com/6966689/230726015-9a90ca9c-e01d-42d0-b693-03daa665b5c0.png">

Pour l'effacer
```sh
kubectl 
```
## 5.10. Registre local de container
Le CI/CD c'est bien, mais en développement ça peut être long.  
Un registre local peut-être pratique !  
Pour installer le registre:
### 5.10.1. créer une résolution de nom spécifique:
Repérer l'adresse ip du load balancer de traefik avec `cluster_get_traefik_lb_ip`  ici 172.31.255.49
```sh
kubectl edit configmap coredns -n kube-system
```
```yaml
apiVersion: v1
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
        hosts {
          172.31.255.49 docker-registry.local
          fallthrough
        }
    }
kind: ConfigMap
metadata:
  creationTimestamp: "2023-04-15T12:59:35Z"
  name: coredns
```
```
dev_install_local_registry
```
### 5.10.2. Pour ajouter une image:  
```sh
docker push docker-registry.local/cert-manage-webhook-oci:1.3.0.2
#et l'utiliser
helm install --namespace kube-certmanager cert-manager-webhook-oci deploy/cert-manager-webhook-oci --set image.repository=docker-registry.local/cert-manage-webhook-oci --set image.tag=1.3.0.2
```
### 5.10.3. Pour désinstaller le registre local:
```
dev_uninstall_local_registry
```
### 5.10.4. Interface utilisateur
Les Ingress sont définis par la variable DOCKER_REGISTRY_UI_DNS_NAMES

## 5.11. Letsencrypt
### 5.11.1. Oracle OCI DNS01
#### 5.11.1.1. Installation
Pour créer deux ClusterIssuer appelés letstencrypt-oci et letsentrypt-staging-oci (à des fins de test) il faut compléter les variables OCI_*.  
Ensuite installer le webhook `cluster_init_install_oci_dns_issuer`.  
#### 5.11.1.2. Utilisation
pour créer un certificat *staging*
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: test.myocihostedzone.org
  namespace: kube-certmanager
spec:
  commonName: test.myocihostedzone.org
  dnsNames:
    - ttest.myocihostedzone.org
  issuerRef:
    name: letsencrypt-staging-oci
    kind: ClusterIssuer
  secretName: test.myocihostedzone.org
```
#### 5.11.1.3. Désinstallation
```sh
cluster_init_remove_oci_dns_issuer
```
### 5.11.2. Azure DNS
Tout d'abord la cli doit être installée
#### 5.11.2.1. Installation
```sh
az login --use-device-code
AZURE_CERT_MANAGER_NEW_SP_NAME=kube-cluster-azure-sp
# This is the name of the resource group that you have your dns zone in.
AZURE_DNS_ZONE_RESOURCE_GROUP=AZURE_DNS_ZONE_RESOURCE_GROUP
# The DNS zone name. It should be something like domain.com or sub.domain.com.
AZURE_DNS_ZONE=example.org
DNS_SP=$(az ad sp create-for-rbac --name $AZURE_CERT_MANAGER_NEW_SP_NAME --output json)
AZURE_CERT_MANAGER_SP_APP_ID=$(echo $DNS_SP | jq -r '.appId')
AZURE_CERT_MANAGER_SP_PASSWORD=$(echo $DNS_SP | jq -r '.password')
AZURE_TENANT_ID=$(echo $DNS_SP | jq -r '.tenant')
AZURE_SUBSCRIPTION_ID=$(az account show --output json | jq -r '.id')
AZURE_DNS_ID=$(az network dns zone show --name $AZURE_DNS_ZONE --resource-group $AZURE_DNS_ZONE_RESOURCE_GROUP --query "id" --output tsv)
az role assignment delete --assignee $AZURE_CERT_MANAGER_SP_APP_ID --role Contributor
az role assignment create --assignee $AZURE_CERT_MANAGER_SP_APP_ID --role "DNS Zone Contributor" --scope $AZURE_DNS_ID
```
Mettez les variables AZURE_DNS_ZONE, AZURE_CERT_MANAGER_SP_APP_ID, AZURE_CERT_MANAGER_SP_PASSWORD, AZURE_TENANT_ID, AZURE_DNS_ID et AZURE_SUBSCRIPTION_ID à jour dans votre oci-manage ou oci-manage-config.sh.   
```sh
cluster_init_azure_dns_issuer
```
#### 5.11.2.2. Utilisation
pour créer un certificat *staging*
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: test.example.org
  namespace: kube-certmanager
spec:
  commonName: test.example.org
  dnsNames:
    - test.example.org
  issuerRef:
    name: letsencrypt-staging-azure
    kind: ClusterIssuer
  secretName: test.example.org
```
#### 5.11.2.3. Désinstallation
```sh
cluster_reset_remove_azure_dns_issuer
```
## 5.12. Bird sur le control-plane
TODO
```sh
sudo apt install bird
sudo systemctl enable bird
sudo birdc configure
```
```
router id $CONTROL_PLANE_IP;
define my_as=$CLUSTER_AS;
protocol direct {
        interface "ens1*", "cilium*", "lxc*";
}
protocol kernel {
        persist off;
        scan time 20;
        learn;
        import all;
        export none;
}
```
