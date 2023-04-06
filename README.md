# Labo OCI-Kubernetes *bare metal*

**Ce projet n'a pas vocation a être réutilisé il s'agit en quelque sorte de notes bien structurées**  
**Si il vous est utile tant mieux !**  
**Si vous avez des corrections, des ajouts, des idées ils sont les bienvenus**  

- [Labo OCI-Kubernetes *bare metal*](#labo-oci-kubernetes-bare-metal)
  - [Objectifs](#objectifs)
  - [Pré-requis](#pré-requis)
  - [Architecture](#architecture)
    - [Structure des locations](#structure-des-locations)
    - [Choix](#choix)
    - [Création des instances *les nœuds*](#création-des-instances-les-nœuds)
    - [Réseau](#réseau)
      - [Cas multi-locations](#cas-multi-locations)
        - [Création des passerelles d'appairage locales](#création-des-passerelles-dappairage-locales)
          - [Requérant](#requérant)
          - ["Acceptant"](#acceptant)
- [Installation du control-plane](#installation-du-control-plane)
  - [1 - connection à distance sur l'instance (avec la clef super-privée) et création de l'utilisateur d'exploitation](#1---connection-à-distance-sur-linstance-avec-la-clef-super-privée-et-création-de-lutilisateur-dexploitation)
  - [2 - login en tant qu'exploitant](#2---login-en-tant-quexploitant)
  - [3 - installation des logiciels](#3---installation-des-logiciels)
  - [compilation de cri-dockerd](#compilation-de-cri-dockerd)
  - [installation du client cilium](#installation-du-client-cilium)
  - [creation manuelle du fichier `/etc/hosts` du control plane](#creation-manuelle-du-fichier-etchosts-du-control-plane)
  - [definitions du firewall](#definitions-du-firewall)
- [Installation des nœuds](#installation-des-nœuds)
- [Quand tous les nœuds sont pré-installés](#quand-tous-les-nœuds-sont-pré-installés)
  - [mise à jour des paquets:](#mise-à-jour-des-paquets)
  - [redémarrer le cluster](#redémarrer-le-cluster)
  - [déployer un fichier](#déployer-un-fichier)
  - [déployer le firewall](#déployer-le-firewall)
  - [(re)créer les fichiers d'interface locale *ex: en cas de modification du routage*](#recréer-les-fichiers-dinterface-locale-ex-en-cas-de-modification-du-routage)
- [Déploiement du cluster](#déploiement-du-cluster)
  - [Autorité de certification](#autorité-de-certification)
  - [Control-Plane](#control-plane)
  - [Workers](#workers)
  - [Effacement du cluster et résinstallation du cluster](#effacement-du-cluster-et-résinstallation-du-cluster)
  - [Bird sur le control-plane](#bird-sur-le-control-plane)

## Objectifs
Créer une maquette bare-metal d'un cluster Kubernetes à l'aide de machine  virtuelles "toujours gratuites" Oracle Cloud Infrastructure.     
Essayer d'automatiser au maximum les tâches de déploiement sans utiliser d'outils spécifiques.  
## Pré-requis
- un compte oracle OCI gratuit par personne dans la même région
- une clef ssh "super privée"
- une autorité de certification racine pour générer tous les certificats
- beaucoup de temps !

## Architecture
Chaque membre a sa propre "location", il a déployé une, deux, trois ou quatre VM dans sa location.  
### Structure des locations
- utilisation de la même région OCI
- un compartiment enfant du compartiment racine contenant tous les objets
- un réseau privé virtuel avec un CIDR du type 10.n.0.0/16
- deux sous-réseaux:
  - public: CIDR 10.n.0.0/24
  - privé: CIDR 10.n.1.0/24
- n-1 passerelles LPG (local peering gateways) avec les noms des autres locations
- un VPN site à site entre la location et le routeur Cisco du labo avec BGP
### Choix
| Élément    | Choix              |
| :--------- | :----------------- |
| Cluster    | Kubernetes v1.26.3 |
| CNI        | Cilium 1.13.1      |
| routage    | BGP                |
| Connexions | VXLAN              |
| VPN        | IKEv2              |
 
### Création des instances *les nœuds*
Chaque nœud est soit:
- une instance VM.Standard.A1.Flex (arm64)
- une instance VM.Standard.E2.1.Micro (amd64).  
  
Chaque instance est déployée avec l'image Ubuntu 22.04 minimale. Pourquoi? Parce que c'est l'OS que nous connaissons le mieux. 
Au moment du déploiement de chaque machine virtuelle, nous avons mis une clef SSH que nous appelons la clef "super privée".  Elle nous sert à initier le déploiement.
### Réseau
- Création des règles de sécurité
  - Réseau public
    - pas de changement
  - Réseau privé
    - on autorise tout (pour le labo)
      - 0.0.0.0/0 => tous les protocoles
      - ::/0 => tous les protocoles  
  
#### Cas multi-locations
Si les nœuds sont dans des locations différentes il faut relier les réseaux privés de chaque location:  

##### Création des passerelles d'appairage locales  
- Créer des stratégies  
  - Elles doivent être créées au niveau du compartiment racine  
  - Stratégies du requérant et des "acceptants":  
  
###### Requérant
```sql
Allow group Administrators to manage local-peering-from in compartment <requestor-compartment>
Endorse group Administrators to manage local-peering-to in any-tenancy
Endorse group Administrators to associate local-peering-gateways in compartment <requestor-compartment> with local-peering-gateways in any-tenancy
```
###### "Acceptant"
```sql
Define tenancy Requestor as <requestor_tenancy_OCID>
Define group Administrators as <RequestorGrp_OCID>
Admit group Administrators of tenancy Requestor to manage local-peering-to in compartment <acceptor-compartment>
Admit group Administrators of tenancy Requestor to associate local-peering-gateways in tenancy Requestor with local-peering-gateways in compartment <acceptor-compartment>
```
- Liaison des passerelles d'appairage locales (local peering gateways)
  - dans la console OCI/VCN de l'acceptant copier l'ocid de la passerelle "acceptante"
  - dans la console OCI/VCN du requérant à droite de la passerelle correspondante on trouve dans le menu "Établir une connexion d'apparage. Il convient d'y coller l'ocid précédent… Si il y a un problème d'autorisation il vient probablement des stratégies mal définies. Voir https://docs.oracle.com/fr-fr/iaas/Content/Network/Tasks/localVCNpeering.htm#Step3 
# Installation du control-plane
## 1 - connection à distance sur l'instance (avec la clef super-privée) et création de l'utilisateur d'exploitation
```sh
ssh -i clef_super_privée ubuntu@instance_ip
USERNAME=exploitant
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
## 2 - login en tant qu'exploitant
```sh
ssh -i clef_super_privée ubuntu@instance_ip
# définition du nom d'hôte
sudo hostnamectl hostname master.private.$compartment.oraclevcn.com
# création d'une clef ssh pour root
sudo ssh-keygen -t ecdsa
#autorisation du login root via ssh
sudo sed -i.bak s/#PermitRootLogin/PermitRootLogin/ /etc/ssh/sshd_config
sudo systemctl restart ssh
```
## 3 - installation des logiciels
```sh
# installation du repo officiel Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/trusted.gpg.d/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
# installation du repo officiel Kubernetes
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/google-k8s.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/trusted.gpg.d/google-k8s.gpg] http://apt.kubernetes.io/ kubernetes-xenial main"| sudo tee /etc/apt/sources.list.d/k8s.list
# mise à jour de l'image de base Ubuntu 22.04 LTS (pour une instation propre)
sudo apt-get update && sudo apt-get dist-upgrade && sudo reboot
# installation
sudo apt-get update && sudo apt-get install vim wireguard iputils-ping docker-ce docker-ce-cli containerd.io docker-compose-plugin git golang-go iputils-ping cron kubeadm kubelet kubectl kubernetes-cni
# ajout de l'exploitant comme administrateur docker
sudo usermod -aG docker $USER
sudo reboot
```
## compilation de cri-dockerd  
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
## installation du client cilium
```sh
CILIUM_CLI_VERSION=$(curl -s https://raw.githubusercontent.com/cilium/cilium-cli/master/stable.txt)
CLI_ARCH=$(dpkg --print-architecture)
if [ "$(uname -m)" = "aarch64" ]; then CLI_ARCH=arm64; fi
curl -L --fail --remote-name-all https://github.com/cilium/cilium-cli/releases/download/${CILIUM_CLI_VERSION}/cilium-linux-${CLI_ARCH}.tar.gz{,.sha256sum}
sha256sum --check cilium-linux-${CLI_ARCH}.tar.gz.sha256sum
sudo tar xzvfC cilium-linux-${CLI_ARCH}.tar.gz /usr/local/bin
rm cilium-linux-${CLI_ARCH}.tar.gz{,.sha256sum}
```
## creation manuelle du fichier `/etc/hosts` du control plane
Le fichier host du contrôle plane permet une résolution de nom statique.  
```hosts
10.0.1.23       node1       node1.private.tenancy1.oraclevcn.com
10.0.0.63                   node1.public.tenancy1.oraclevcn.com
10.0.0.75       master      master.private.tenancy1.oraclevcn.com
10.0.0.54                   oci-master.public.tenancy1.oraclevcn.com
10.1.0.201      node2       node2.private.tenancy2.oraclevcn.com
10.1.1.186                  node2.public.tenancy2.oraclevcn.com
```
## definitions du firewall
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
# Installation des nœuds
**Cela ne peut être fait que si les réseaux privés sont interconnectés**  
Jettez un coup d'œil au script oci-manage  
Il contient toutes les fonctionsd'automatisations, elles sont non documentées car on manque de courage !  
Au début du fichier il y a un certain nombre de variables…  
Copiez les dans un fichiers `./oci-manage-config.sh` et éditez les.  
Pour activer les fonctions il faut simplement faire `. ./oci-manage`
```sh
EXPLOITANT=adminuser
PASS=unvraimotdepasse
NODE_FQDN=node.fqdn
init_create_admin_user_with_key node.fqdn $EXPLOITANT $PASS
init_allow_keys_for_root $NODE_FQDN $EXPLOITANT $PASS
init_deploy_admin_keys_to_admin_user $NODE_FQDN $EXPLOITANT
init_set_ramdisk $NODE_FQDN
init_set_iptables $NODE_FQDN
#attention ne fonctionne que si cri-dockerd existe dans le cluster pour la bonne architecture
#voir les variables ARM_SRC et X86_64_SRC de oci-manage-config.sh
init_install_cri_docker $NODE_FQDN
init_install_software $NODE_FQDN $EXPLOITANT
# sur les VM avec une carte réseau privée et une publique
# après avoir noté l'adresse mac et l'adresse ip privée de l'instance
init_create_private_interface $NODE_FQDN macaddress privateipaddress
```
# Quand tous les nœuds sont pré-installés
Mettre à jour la variable CLUSTER_MEMBERS du fichier de configuration.  
Avec oci-manage on peut alors effectuer des tâches "globales"
## mise à jour des paquets:  
```sh
cluster_apt_dist_upgrade
```
## redémarrer le cluster
```sh
cluster_reboot
```
## déployer un fichier 
```sh
#en tant que root
cluster_copy_file_as_root /etc/hosts /etc/hosts
#sinon
cluster_copy_file_as_current_user ~/oci-manage ~/oci-manage
cluster_copy_file_as_current_user ~/oci-manage-config.sh ~/oci-manage-config.sh
```
## déployer le firewall
```sh
cluster_copy_file_as_root /etc/iptables/rules.v4 /etc/iptables/rules.v4
cluster_run_on_all_members_as_root "iptables-restore -t /etc/iptables/rules.v4"
```
## (re)créer les fichiers d'interface locale *ex: en cas de modification du routage*
```sh
cluster_recreate_private_interface
cluster_recreate_master_private_interface
```
# Déploiement du cluster
Normalement toutes les machines sont prêtes, on peut vérifier qu'elles peuvent communiquer entre elles:
```sh
cluster_ping_host_from_members $CONTROL_PLANE_LOCAL
```
C'est tout bon ? On peut passer aux choses sérieuses.
## Autorité de certification
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

## Control-Plane
À l'aide de `oci-manage`  
```sh
cluster_init_create_control_plane
```

## Workers
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
## Effacement du cluster et résinstallation du cluster
```sh
cluster_reset_members ; cluster_reset_control_plane
rm -f ~/.kube/config
sudo rm -f /root/.kube/config
cluster_init_create_control_plane; sleep 30; cluster_init_create_members ; sleep 30 ; cluster_init_create_post_install
```

## Bird sur le control-plane
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