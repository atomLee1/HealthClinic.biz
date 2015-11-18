﻿module MyHealth.Client.Cordova.Application.Shared {

    var app = getModule();

    export class DataService {

        private client: any;
        public activeDoctor: Doctor = new Doctor();

        private $rootScope: any;
        private configService: ConfigService;
        private $ionicPlatform: ionic.platform.IonicPlatformService;

        public getClient() {
            if (!this.client) {
                this.client = new WindowsAzure.MobileServiceClient(
                    this.configService.Azure.API_URL,
                    this.configService.Azure.API_ALT_URL,
                    ''
                ).withFilter((request, next, callback) => {
                    if (request.url.indexOf('/tables/homeappointment') >= 0 && request.url.indexOf('$expand') === -1) {
                        request.url = request.url + ((request.url.indexOf('?') === -1) ? '?' : '&');
                        request.url = request.url + '$expand=patient';
                    }
                    next(request, callback);
                });
            }
            return this.client;
        }

        public login() {
            return new Promise<any>((resolve, reject) => {
                if (this.configService.General.REQUIRE_LOGIN) {
                    this.$ionicPlatform.ready(() => {
                        this.getClient().login('aad').then((loginResult: any) => {
                            resolve();
                        });
                    });
                } else {
                    resolve();
                }
            });
        }

        public getActiveDoctor() {
            return new Promise<Doctor>((resolve, reject) => {
                if (!this.activeDoctor.id) {
                    this.login().then(() => {
                        var doctorsTable = this.getClient().getTable('doctor');
                        doctorsTable.where({ id: this.configService.General.DEFAULT_DOCTOR_GUID }).read().done((result: any) => {
                            this.activeDoctor.deserialize(result[0]);
                            this.$rootScope.$broadcast('activeDoctorUpdated');
                            resolve(this.activeDoctor);
                        }, (error: any) => {
                            console.log(error);
                        });
                    });
                } else {
                    resolve(this.activeDoctor);
                }
            });
        }

        public getHomeAppointments() {
            return new Promise<any>((resolve, reject) => {
                this.getActiveDoctor().then((doctor: any) => {
                    var homeAppointmentsTable = this.getClient().getTable('homeappointment');
                    homeAppointmentsTable.take(10)
                        .orderBy('dateTime')
                        .where({ doctorId: doctor.doctorId, tenantId: 1 })
                        .read()
                        .done((result: any) => {
                            resolve(result);
                        }, (error: any) => {
                            console.log(error);
                        });
                });
            });
        }

        updateAppointment(appointment: any) {
            return new Promise<any>((resolve, reject) => {
                var homeAppointmentsTable = this.getClient().getTable('homeappointment');
                homeAppointmentsTable.update(appointment).done((result: any) => {
                    resolve(result);
                }, (err: any) => {
                    console.log(`Error: ${err}`);
                });
            });
        }

        sendNotification(data: any) {
            var notification = data;
            this.getActiveDoctor().then((doctor: any) => {
                notification.doctorId = doctor.doctorId.toString();
                this.getClient().invokeApi('NotifyDelay', {
                    body: notification,
                    method: 'post'
                }).done((results) => {
                    // console.log(results);
                }, (error) => {
                    console.error(error);
                });
            });
        }

        constructor($rootScope: any, configService: ConfigService, $ionicPlatform: ionic.platform.IonicPlatformService) {
            this.$rootScope = $rootScope;
            this.configService = configService;
            this.$ionicPlatform = $ionicPlatform;
        }

    }

    app.service('dataService', DataService);
}
