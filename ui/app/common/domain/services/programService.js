'use strict';
angular.module('bahmni.common.domain')
    .factory('programService', ['$http', 'appService', function ($http, appService) {

        var getAllPrograms = function () {
            return $http.get(Bahmni.Common.Constants.programUrl, {params: {v: 'default'}}).then(function (data) {
                var allPrograms = filterRetiredPrograms(data.data.results);
                _.forEach(allPrograms, function (program) {
                    program.allWorkflows = filterRetiredWorkflowsAndStates(program.allWorkflows);
                    if (program.outcomesConcept) {
                        program.outcomesConcept.setMembers = filterRetiredOutcomes(program.outcomesConcept.setMembers);
                    }
                });
                return allPrograms;
            });
        };

        var enrollPatientToAProgram = function (patientUuid, programUuid, dateEnrolled, stateUuid, patientProgramAttributes, programAttributeTypes) {
            var attributeFormatter = new Bahmni.Common.Domain.AttributeFormatter();
            var req = {
                url: Bahmni.Common.Constants.programEnrollPatientUrl,
                content: {
                    patient: patientUuid,
                    program: programUuid,
                    dateEnrolled: moment(dateEnrolled).format(Bahmni.Common.Constants.ServerDateTimeFormat),
                    attributes: attributeFormatter.removeUnfilledAttributes(attributeFormatter.getMrsAttributes(patientProgramAttributes, programAttributeTypes))
                },
                headers: {"Content-Type": "application/json"}
            };
            if(!_.isEmpty(stateUuid)){
              req.content.states = [
                  {
                      state:stateUuid,
                      startDate:moment(dateEnrolled).format(Bahmni.Common.Constants.ServerDateTimeFormat)
                  }
              ]
            }
            return $http.post(req.url, req.content, req.headers);
        };

        var getPatientPrograms = function (patientUuid) {
            var req = {
                url: Bahmni.Common.Constants.programEnrollPatientUrl,
                params: {
                    v: Bahmni.Common.Constants.programEnrollmentFullInformation,
                    patient: patientUuid
                }
            };
            return $http.get(req.url, {params: req.params}).then(function(data) {
                return groupPrograms(data.data.results);
            });
        };

        var groupPrograms = function(patientPrograms) {
                var activePrograms = [];
                var endedPrograms = [];
                var groupedPrograms = {};
                if (patientPrograms) {
                    var filteredPrograms = filterRetiredPrograms(patientPrograms);
                    _.forEach(filteredPrograms, function (program) {
                        program.dateEnrolled = Bahmni.Common.Util.DateUtil.parseServerDateToDate(program.dateEnrolled);
                        program.dateCompleted = Bahmni.Common.Util.DateUtil.parseServerDateToDate(program.dateCompleted);
                        program.program.allWorkflows = filterRetiredWorkflowsAndStates(program.program.allWorkflows);
                        if (program.dateCompleted) {
                            endedPrograms.push(program);
                        } else {
                            activePrograms.push(program);
                        }
                    });
                    groupedPrograms.activePrograms =  _.sortBy(activePrograms, function(program){ return moment(program.dateEnrolled).toDate() }).reverse();
                    groupedPrograms.endedPrograms = _.sortBy(endedPrograms, function(program){ return moment(program.dateCompleted).toDate() }).reverse();
                }
                return groupedPrograms;
        };

        var filterRetiredPrograms = function (programs) {
            return _.filter(programs, function (program) {
                return !program.retired;
            });
        };

        var filterRetiredWorkflowsAndStates = function (workflows) {
            var allWorkflows = _.filter(workflows, function (workflow) {
                return !workflow.retired;
            });
            _.forEach(allWorkflows, function (workflow) {
                workflow.states = _.filter(workflow.states, function (state) {
                    return !state.retired
                })
            });
            return allWorkflows;
        };

        var filterRetiredOutcomes = function (outcomes) {
            return _.filter(outcomes, function (outcome) {
                return !outcome.retired;
            })
        };

        var constructStatesPayload = function(stateUuid, onDate, currProgramStateUuid){
            var states =[];
            if (stateUuid) {
                states.push({
                        state: {
                            uuid: stateUuid
                        },
                        uuid: currProgramStateUuid,
                        startDate: onDate
                    }
                );
            }
            return states;
        };

        var savePatientProgram = function(patientProgramUuid, stateUuid, onDate, currProgramStateUuid) {
            var req = {
                url: Bahmni.Common.Constants.programEnrollPatientUrl + "/" + patientProgramUuid,
                content: {
                    states: constructStatesPayload(stateUuid, onDate, currProgramStateUuid)
                },
                headers: {"Content-Type": "application/json"}
            };
            return $http.post(req.url, req.content, req.headers);
        };

        var endPatientProgram = function (patientProgramUuid, asOfDate, outcomeUuid){
            var req = {
                url: Bahmni.Common.Constants.programEnrollPatientUrl + "/" + patientProgramUuid,
                content: {
                    dateCompleted: moment(asOfDate).format(Bahmni.Common.Constants.ServerDateTimeFormat),
                    outcome: outcomeUuid
                },
                headers: {"Content-Type": "application/json"}
            };
            return $http.post(req.url, req.content, req.headers);
        };

        var deletePatientState = function(patientProgramUuid, patientStateUuid) {
            var req = {
                url: Bahmni.Common.Constants.programEnrollPatientUrl + "/" + patientProgramUuid + "/state/" + patientStateUuid,
                content: {
                    "!purge": "",
                    "reason": "User deleted the state."
                },
                headers: {"Content-Type": "application/json"}
            };
            return $http.delete(req.url, req.content, req.headers);
        };

        var getProgramAttributeTypes = function () {
            return $http.get(Bahmni.Common.Constants.programAttributeTypes, {params: {v: 'custom:(uuid,name,description,datatypeClassname)'}}).then(function (response) {
                var mandatoryProgramAttributes = appService.getAppDescriptor().getConfigValue("mandatoryProgramAttributes");
                return new Bahmni.Common.Domain.AttributeTypeMapper().mapFromOpenmrsAttributeTypes(response.data.results, mandatoryProgramAttributes).attributeTypes;
            });
        };

        return {
            getAllPrograms: getAllPrograms,
            enrollPatientToAProgram: enrollPatientToAProgram,
            getPatientPrograms: getPatientPrograms,
            endPatientProgram: endPatientProgram,
            savePatientProgram: savePatientProgram,
            deletePatientState: deletePatientState,
            getProgramAttributeTypes : getProgramAttributeTypes
        };

    }]);
